use crate::bus::EventSender;
use crate::config::Config;
use crate::events::{TelemetryEvent, now_rfc3339};
use anyhow::{Context, Result, bail};
use serde::Deserialize;
use std::path::PathBuf;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::watch;

pub const LISTENER_PORT: u16 = 19387;

const HOOK_MARKER_START: &str = "# --- hive collector hook (start) ---";
const HOOK_MARKER_END: &str = "# --- hive collector hook (end) ---";
const HOOK_SNIPPET: &str = r#"# --- hive collector hook (start) ---
_hive_collector_preexec() {
  _hive_last_cmd="$1"
  _hive_t0=$SECONDS
}
_hive_collector_precmd() {
  local ec=$?
  [ -n "$_hive_last_cmd" ] || return
  local sep=$'\x1f'
  local payload
  payload=$(printf '%s%s%s%s%s%s%s%s' "$_hive_last_cmd" "$sep" "$$" "$sep" "$ec" "$sep" "$(( (SECONDS - _hive_t0) * 1000 ))" "$sep$PWD" | \
    python3 -c 'import json,sys; cmd,pid,ec,ms,cwd=sys.stdin.read().split("\x1f"); print(json.dumps({"type":"done","cmd":cmd,"pid":int(pid),"exit":int(ec),"ms":int(ms),"cwd":cwd}))' 2>/dev/null) || true
  [ -n "$payload" ] && printf '%s\n' "$payload" > /dev/tcp/127.0.0.1/19387 2>/dev/null || true
  _hive_last_cmd=""
}
autoload -Uz add-zsh-hook 2>/dev/null
add-zsh-hook preexec _hive_collector_preexec 2>/dev/null
add-zsh-hook precmd _hive_collector_precmd 2>/dev/null
# --- hive collector hook (end) ---
"#;

#[derive(Debug, Deserialize)]
struct TerminalMessage {
    cmd: String,
    pid: Option<u32>,
    /// Present on `precmd` completion reports (new hook shape).
    #[serde(default, rename = "type")]
    kind: Option<String>,
    exit: Option<i32>,
    ms: Option<i64>,
    cwd: Option<String>,
}

/// Serves the loopback listener that shell hooks post terminal commands to.
pub async fn serve(
    tx: EventSender,
    _config: Config,
    mut shutdown: watch::Receiver<bool>,
) -> Result<()> {
    let listener = TcpListener::bind(("127.0.0.1", LISTENER_PORT))
        .await
        .with_context(|| format!("failed to bind 127.0.0.1:{LISTENER_PORT}"))?;
    tracing::info!("terminal hook listener on 127.0.0.1:{LISTENER_PORT}");

    loop {
        tokio::select! {
            _ = shutdown.changed() => {
                if *shutdown.borrow() {
                    break;
                }
            }
            accepted = listener.accept() => {
                let (stream, _) = match accepted {
                    Ok(conn) => conn,
                    Err(err) => {
                        tracing::warn!(%err, "terminal listener accept failed");
                        continue;
                    }
                };
                let tx = tx.clone();
                tokio::spawn(async move {
                    if let Err(err) = handle_conn(stream, &tx).await {
                        tracing::debug!(%err, "terminal hook message dropped");
                    }
                });
            }
        }
    }
    Ok(())
}

async fn handle_conn(mut stream: TcpStream, tx: &EventSender) -> Result<()> {
    let mut buf = Vec::new();
    let mut chunk = [0u8; 2048];
    loop {
        let n = stream.read(&mut chunk).await?;
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&chunk[..n]);
        if buf.len() > 4096 {
            break;
        }
    }
    let text = String::from_utf8_lossy(&buf);
    if let Ok(msg) = serde_json::from_str::<TerminalMessage>(&text) {
        if !msg.cmd.trim().is_empty() {
            emit_terminal(tx, &msg);
            if msg.kind.as_deref() == Some("done") {
                emit_test_run(tx, &msg);
            }
        }
    }
    let _ = stream.write_all(b"ok").await;
    Ok(())
}

fn emit_terminal(tx: &EventSender, msg: &TerminalMessage) {
    let event = TelemetryEvent::TerminalCommand {
        timestamp: now_rfc3339(),
        command: msg.cmd.clone(),
        pid: msg.pid.map(|p| p as u64),
    };
    crate::bus::try_send(tx, event);
    if let Some(pid) = msg.pid {
        if pid > 0 {
            let event = TelemetryEvent::ProcessStarted {
                timestamp: now_rfc3339(),
                pid: pid as u64,
                ppid: None,
                name: None,
                command: msg.cmd.clone(),
            };
            crate::bus::try_send(tx, event);
        }
    }
}

/// Commands whose completion is worth reporting as a test run.
fn is_test_command(cmd: &str) -> bool {
    let c = cmd.to_lowercase();
    [
        "bun test",
        "vitest",
        "jest",
        "pytest",
        "cargo test",
        "go test",
        "npm test",
        "npm run test",
        "pnpm test",
        "yarn test",
        "node --test",
    ]
    .iter()
    .any(|k| c.contains(k))
}

/// Nearest git repo slug (`owner/name`) for a working directory.
fn repo_slug_for_dir(dir: &str) -> Option<String> {
    let repo = git2::Repository::discover(dir).ok()?;
    let origin = repo.find_remote("origin").ok()?;
    let url = origin.url()?;
    crate::modules::git::remote_slug(url)
}

/// A completed test command becomes a TestStarted + TestFinished pair so the
/// workspace's red/green pulse reflects human-run tests, not just CI.
fn emit_test_run(tx: &EventSender, msg: &TerminalMessage) {
    if !is_test_command(&msg.cmd) {
        return;
    }
    let (Some(exit), Some(ms)) = (msg.exit, msg.ms) else {
        return;
    };
    let passed = exit == 0;
    let repository = msg.cwd.as_deref().and_then(repo_slug_for_dir);
    let branch = msg
        .cwd
        .as_deref()
        .and_then(directory_branch)
        .or_else(|| None);
    let run_id = uuid::Uuid::new_v4().to_string();
    tracing::debug!(run_id, passed, ms, "terminal: emitting test run");

    crate::bus::try_send(
        tx,
        TelemetryEvent::TestStarted {
            timestamp: now_rfc3339(),
            test_run_id: run_id.clone(),
            activity_id: None,
            repository: repository.clone(),
            branch: branch.clone(),
            command: Some(msg.cmd.clone()),
        },
    );
    crate::bus::try_send(
        tx,
        TelemetryEvent::TestFinished {
            timestamp: now_rfc3339(),
            test_run_id: run_id,
            status: if passed { "passed" } else { "failed" }.into(),
            total_tests: None,
            passed_tests: None,
            failed_tests: None,
            skipped_tests: None,
            duration_ms: Some(ms.max(0) as u64),
        },
    );
}

fn directory_branch(dir: &str) -> Option<String> {
    let repo = git2::Repository::discover(dir).ok()?;
    let head = repo.find_reference("HEAD").ok()?;
    let target = head
        .symbolic_target()
        .or_else(|| head.name())
        .map(String::from)?;
    target.strip_prefix("refs/heads/").map(|s| s.to_string())
}

fn rc_path() -> PathBuf {
    if let Ok(shell) = std::env::var("SHELL") {
        if shell.contains("bash") {
            if let Ok(home) = std::env::var("HOME") {
                return PathBuf::from(home).join(".bashrc");
            }
        }
    }
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home).join(".zshrc");
    }
    PathBuf::from(".zshrc")
}

pub fn install_hook() -> Result<()> {
    let path = rc_path();
    let existing = std::fs::read_to_string(&path).unwrap_or_default();
    if existing.contains(HOOK_MARKER_START) {
        return Ok(());
    }
    let mut updated = existing;
    if !updated.ends_with('\n') {
        updated.push('\n');
    }
    updated.push_str(HOOK_SNIPPET);
    updated.push('\n');
    std::fs::write(&path, updated)
        .with_context(|| format!("failed to write hook into {}", path.display()))?;
    println!("Installed collector hook into {}", path.display());
    println!(
        "Open a new terminal (or run `source {}`) to activate.",
        path.display()
    );
    Ok(())
}

pub fn uninstall_hook() -> Result<()> {
    let path = rc_path();
    let existing = std::fs::read_to_string(&path)?;
    if !existing.contains(HOOK_MARKER_START) {
        bail!("no collector hook found in {}", path.display());
    }
    let start = existing
        .find(HOOK_MARKER_START)
        .ok_or_else(|| anyhow::anyhow!("hook marker missing"))?;
    let end = existing
        .find(HOOK_MARKER_END)
        .map(|i| i + HOOK_MARKER_END.len())
        .ok_or_else(|| anyhow::anyhow!("hook end marker missing"))?;
    let mut updated = String::new();
    updated.push_str(&existing[..start]);
    updated.push_str(&existing[end..]);
    std::fs::write(&path, updated)
        .with_context(|| format!("failed to update {}", path.display()))?;
    println!("Removed collector hook from {}", path.display());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_terminal_message() {
        let msg: TerminalMessage =
            serde_json::from_str("{\"cmd\":\"bun test\",\"pid\":1234}").unwrap();
        assert_eq!(msg.cmd, "bun test");
        assert_eq!(msg.pid, Some(1234));
    }

    #[test]
    fn hook_snippet_round_trips() {
        assert!(HOOK_SNIPPET.contains("19387"));
        assert!(HOOK_SNIPPET.starts_with(HOOK_MARKER_START));
        assert!(HOOK_SNIPPET.trim_end().ends_with(HOOK_MARKER_END));
    }
}
