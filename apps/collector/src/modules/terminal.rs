use crate::bus::EventSender;
use crate::config::Config;
use crate::events::{now_rfc3339, TelemetryEvent};
use anyhow::{bail, Context, Result};
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
  local cmd="$1"
  printf '{"cmd":%s,"pid":%s}\n' "$(printf '%s' "$cmd" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))' 2>/dev/null || printf '"%s"' "${cmd//\"/\\\"}")" "$$" > /dev/tcp/127.0.0.1/19387 2>/dev/null || true
}
autoload -Uz add-zsh-hook 2>/dev/null
add-zsh-hook preexec _hive_collector_preexec 2>/dev/null
# --- hive collector hook (end) ---
"#;

#[derive(Debug, Deserialize)]
struct TerminalMessage {
    cmd: String,
    pid: Option<u32>,
}

/// Serves the loopback listener that shell hooks post terminal commands to.
pub async fn serve(tx: EventSender, _config: Config, mut shutdown: watch::Receiver<bool>) -> Result<()> {
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
    println!("Open a new terminal (or run `source {}`) to activate.", path.display());
    Ok(())
}

pub fn uninstall_hook() -> Result<()> {
    let path = rc_path();
    let existing = std::fs::read_to_string(&path)?;
    if !existing.contains(HOOK_MARKER_START) {
        bail!("no collector hook found in {}", path.display());
    }
    let start = existing.find(HOOK_MARKER_START).ok_or_else(|| anyhow::anyhow!("hook marker missing"))?;
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