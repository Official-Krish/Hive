use crate::bus::EventSender;
use crate::config::Config;
use crate::events::{TelemetryEvent, now_rfc3339};
use serde_json::Value;
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::sync::watch;

const IDLE_TIMEOUT_MS: i64 = 10 * 60 * 1000;

/// A session whose log hasn't been appended to for this long is treated as
/// waiting on the user (Claude/Codex stream JSONL constantly while generating
/// — silence means they're blocked on a prompt/approval).
const STALLED_MS: i64 = 2 * 60 * 1000;

fn home_dir() -> Option<PathBuf> {
    std::env::var("HOME").ok().map(PathBuf::from)
}

/// Splits a raw buffer into complete lines, returning `(new_offset, lines)`.
fn consume_lines(buf: &[u8], _offset: usize) -> (usize, Vec<String>) {
    let text = String::from_utf8_lossy(buf);
    let mut lines = Vec::new();
    let mut start = 0;
    for (i, ch) in text.char_indices() {
        if ch == '\n' {
            lines.push(text[start..i].trim().to_string());
            start = i + 1;
        }
    }
    (start, lines.into_iter().filter(|l| !l.is_empty()).collect())
}

fn tail_jsonl(path: &Path, offset: &mut usize) -> Vec<String> {
    let Ok(mut f) = File::open(path) else {
        return Vec::new();
    };
    let len = f.metadata().map(|m| m.len() as usize).unwrap_or(0);
    if len < *offset {
        *offset = 0;
    }
    if len <= *offset {
        return Vec::new();
    }
    f.seek(SeekFrom::Start(*offset as u64)).ok();
    let mut buf = vec![0u8; len - *offset];
    if f.read_exact(&mut buf).is_err() {
        return Vec::new();
    }
    let (consumed, lines) = consume_lines(&buf, *offset);
    *offset += consumed;
    lines
}

/// Shared JSONL tailer for Claude Code and Codex session logs.
struct JsonlAgent {
    name: &'static str,
    /// session id -> last log activity (file mtime, ms epoch)
    sessions: HashMap<String, i64>,
    /// sessions we've reported as waiting on the user
    waiting: std::collections::HashSet<String>,
    offsets: HashMap<PathBuf, usize>,
}

impl JsonlAgent {
    fn new(name: &'static str) -> Self {
        Self {
            name,
            sessions: HashMap::new(),
            waiting: std::collections::HashSet::new(),
            offsets: HashMap::new(),
        }
    }

    /// Tails a directory of `*.jsonl` session files, invoking `parse` per line.
    fn poll(
        &mut self,
        tx: &EventSender,
        dir: &Path,
        parse: impl Fn(&str, &str, &str) -> Vec<TelemetryEvent>,
    ) {
        let Ok(entries) = std::fs::read_dir(dir) else {
            return;
        };
        let mut files: Vec<PathBuf> = entries
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| p.extension().map(|e| e == "jsonl").unwrap_or(false))
            .collect();
        files.sort_by_key(|p| p.mtime_ms());

        for path in files {
            let session_id = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            if session_id.is_empty() {
                continue;
            }
            let offset = self.offsets.entry(path.clone()).or_insert(0);
            for line in tail_jsonl(&path, offset) {
                for event in parse(&line, &session_id, self.name) {
                    crate::bus::try_send(tx, event);
                }
            }

            // Activity signal = file mtime (appended on every agent turn).
            let mtime = path.mtime_ms();
            let now_ms = chrono::Utc::now().timestamp_millis();
            match self.sessions.get_mut(&session_id) {
                Some(last) => {
                    if mtime > *last {
                        *last = mtime;
                    }
                    let stalled = now_ms - *last > STALLED_MS;
                    let was_waiting = self.waiting.contains(&session_id);
                    if stalled && !was_waiting {
                        self.waiting.insert(session_id.clone());
                        crate::bus::try_send(
                            tx,
                            TelemetryEvent::AgentStatus {
                                timestamp: now_rfc3339(),
                                session_id: session_id.clone(),
                                status: "waiting_approval".into(),
                            },
                        );
                    } else if !stalled && was_waiting {
                        self.waiting.remove(&session_id);
                        crate::bus::try_send(
                            tx,
                            TelemetryEvent::AgentStatus {
                                timestamp: now_rfc3339(),
                                session_id: session_id.clone(),
                                status: "running".into(),
                            },
                        );
                    }
                }
                None => {
                    // First sighting — emit started; a session born silent is
                    // immediately waiting.
                    let stalled_at_birth = now_ms - mtime > STALLED_MS;
                    self.sessions.insert(session_id.clone(), mtime);
                    self.emit_started(tx, &session_id);
                    if stalled_at_birth {
                        self.waiting.insert(session_id.clone());
                        crate::bus::try_send(
                            tx,
                            TelemetryEvent::AgentStatus {
                                timestamp: now_rfc3339(),
                                session_id: session_id.clone(),
                                status: "waiting_approval".into(),
                            },
                        );
                    }
                }
            }
        }
        self.flush_idle(tx);
    }

    fn emit_started(&mut self, tx: &EventSender, session_id: &str) {
        if self.sessions.contains_key(session_id) {
            return;
        }
        self.sessions.insert(
            session_id.to_string(),
            chrono::Utc::now().timestamp_millis(),
        );
        let event = TelemetryEvent::AgentStarted {
            timestamp: now_rfc3339(),
            session_id: session_id.to_string(),
            agent: self.name.to_string(),
            model: None,
            version: None,
            title: None,
            repository: None,
            branch: None,
        };
        crate::bus::try_send(tx, event);
    }

    fn flush_idle(&mut self, tx: &EventSender) {
        let now = chrono::Utc::now().timestamp_millis();
        let idle: Vec<String> = self
            .sessions
            .iter()
            .filter(|(_, last)| now - **last > IDLE_TIMEOUT_MS)
            .map(|(id, _)| id.clone())
            .collect();
        for id in idle {
            self.sessions.remove(&id);
            self.waiting.remove(&id);
            let event = TelemetryEvent::AgentStopped {
                timestamp: now_rfc3339(),
                session_id: id.clone(),
                status: "stopped".to_string(),
            };
            crate::bus::try_send(tx, event);
        }
    }
}

trait PathMtime {
    fn mtime_ms(&self) -> i64;
}

impl PathMtime for PathBuf {
    fn mtime_ms(&self) -> i64 {
        self.metadata()
            .and_then(|m| m.modified())
            .map(|t| {
                t.duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as i64)
                    .unwrap_or(0)
            })
            .unwrap_or(0)
    }
}

// ---------------------------------------------------------------------------
// Claude Code: `~/.claude/projects/*/*.jsonl`
// ---------------------------------------------------------------------------

fn parse_claude(line: &str, session_id: &str, _agent: &str) -> Vec<TelemetryEvent> {
    let Ok(value) = serde_json::from_str::<Value>(line) else {
        return Vec::new();
    };
    let Some(event_type) = value.get("type").and_then(|v| v.as_str()) else {
        return Vec::new();
    };
    let mut events = Vec::new();
    match event_type {
        "summary" => {
            if let Some(summary) = value.get("summary").and_then(|v| v.as_str()) {
                events.push(TelemetryEvent::AgentSummary {
                    timestamp: now_rfc3339(),
                    session_id: session_id.to_string(),
                    summary: summary.to_string(),
                });
            }
        }
        "assistant" => {
            let usage = value.get("usage");
            if let Some(usage) = usage {
                let input_tokens = usage
                    .get("input_tokens")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0);
                let output_tokens = usage
                    .get("output_tokens")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0);
                let cached = usage
                    .get("cache_read_input_tokens")
                    .and_then(|v| v.as_u64())
                    .or_else(|| {
                        usage
                            .get("cache_creation_input_tokens")
                            .and_then(|v| v.as_u64())
                    });
                let model = value
                    .get("model")
                    .and_then(|v| v.as_str())
                    .or_else(|| value.pointer("/message/model").and_then(|v| v.as_str()))
                    .unwrap_or("claude")
                    .to_string();
                events.push(TelemetryEvent::AgentTokenUsage {
                    timestamp: now_rfc3339(),
                    session_id: session_id.to_string(),
                    provider: "anthropic".to_string(),
                    model,
                    input_tokens,
                    output_tokens,
                    cached_input_tokens: cached,
                });
            }
        }
        _ => {}
    }
    events
}

// ---------------------------------------------------------------------------
// Codex: `~/.codex/sessions/*.jsonl`
// ---------------------------------------------------------------------------

fn parse_codex(line: &str, session_id: &str, _agent: &str) -> Vec<TelemetryEvent> {
    let Ok(value) = serde_json::from_str::<Value>(line) else {
        return Vec::new();
    };
    let payload = value.get("payload");
    let role = payload.and_then(|p| p.get("role")).and_then(|v| v.as_str());
    let usage = payload.and_then(|p| p.get("usage"));
    if role != Some("assistant") || usage.is_none() {
        return Vec::new();
    }
    let usage = usage.unwrap();
    let input_tokens = usage
        .get("input_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let output_tokens = usage
        .get("output_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let model = payload
        .and_then(|p| p.get("model"))
        .and_then(|v| v.as_str())
        .unwrap_or("codex")
        .to_string();
    vec![TelemetryEvent::AgentTokenUsage {
        timestamp: now_rfc3339(),
        session_id: session_id.to_string(),
        provider: "openai".to_string(),
        model,
        input_tokens,
        output_tokens,
        cached_input_tokens: None,
    }]
}

// ---------------------------------------------------------------------------
// Spawners
// ---------------------------------------------------------------------------

pub async fn spawn_agents(tx: EventSender, config: Config, mut shutdown: watch::Receiver<bool>) {
    let mut claude = JsonlAgent::new("claude");
    let mut codex = JsonlAgent::new("codex");
    let mut opencode = crate::modules::opencode::OpenCodeTracker::new(&config.opencode_db);
    let mut interval = tokio::time::interval(Duration::from_secs(5));

    loop {
        tokio::select! {
            _ = interval.tick() => {
                if let Some(home) = home_dir() {
                    if let Ok(entries) = std::fs::read_dir(home.join(".claude").join("projects")) {
                        for entry in entries.flatten() {
                            claude.poll(&tx, &entry.path(), parse_claude);
                        }
                    }
                    codex.poll(&tx, &home.join(".codex").join("sessions"), parse_codex);
                    opencode.poll(&tx);
                }
            }
            _ = shutdown.changed() => {
                if *shutdown.borrow() {
                    break;
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn consumes_lines_only_complete() {
        let (offset, lines) = consume_lines(b"a\nb\nc\nd", 0);
        assert_eq!(offset, 6);
        assert_eq!(lines, vec!["a", "b", "c"]);
    }

    #[test]
    fn parses_claude_summary() {
        let events = parse_claude(
            "{\"type\":\"summary\",\"sessionId\":\"s1\",\"summary\":\"refactored auth\"}",
            "s1",
            "claude",
        );
        assert!(
            matches!(&events[0], TelemetryEvent::AgentSummary { summary, .. } if summary == "refactored auth")
        );
    }

    #[test]
    fn parses_claude_token_usage() {
        let events = parse_claude(
            "{\"type\":\"assistant\",\"model\":\"claude-sonnet\",\"usage\":{\"input_tokens\":10,\"output_tokens\":5,\"cache_read_input_tokens\":3}}",
            "s1",
            "claude",
        );
        match &events[0] {
            TelemetryEvent::AgentTokenUsage {
                input_tokens,
                output_tokens,
                cached_input_tokens,
                model,
                ..
            } => {
                assert_eq!(*input_tokens, 10);
                assert_eq!(*output_tokens, 5);
                assert_eq!(*cached_input_tokens, Some(3));
                assert_eq!(model, "claude-sonnet");
            }
            other => panic!("unexpected event: {other:?}"),
        }
    }

    #[test]
    fn parses_codex_token_usage() {
        let events = parse_codex(
            "{\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"assistant\",\"model\":\"gpt-5\",\"usage\":{\"input_tokens\":2,\"output_tokens\":7}}}",
            "s1",
            "codex",
        );
        match &events[0] {
            TelemetryEvent::AgentTokenUsage {
                input_tokens,
                output_tokens,
                model,
                ..
            } => {
                assert_eq!(*input_tokens, 2);
                assert_eq!(*output_tokens, 7);
                assert_eq!(model, "gpt-5");
            }
            other => panic!("unexpected event: {other:?}"),
        }
    }
}
