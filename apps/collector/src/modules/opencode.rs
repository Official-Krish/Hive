use crate::bus::EventSender;
use crate::events::{TelemetryEvent, now_rfc3339};
use anyhow::Result;
use rusqlite::Connection;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

/// Sessions are considered stopped when they show no activity for this long.
const IDLE_TIMEOUT_MS: i64 = 10 * 60 * 1000;

/// A RUNNING session whose `time_updated` hasn't moved for this long is
/// treated as waiting on the user (OpenCode streams message events constantly
/// while generating — silence means it's blocked on a prompt/approval).
const STALLED_MS: i64 = 2 * 60 * 1000;

/// Newer opencode versions store sessions in a SQLite DB
/// (`~/.local/share/opencode/opencode.db`); older ones write JSON files under
/// `project/<slug>/storage/<session>/message/<messageId>/message.json`. This
/// tracker reads the SQLite DB when present and falls back to the newest-message
/// JSON parser otherwise.
pub struct OpenCodeTracker {
    db: Option<PathBuf>,
    /// session id -> last observed cumulative token totals + last activity
    sessions: HashMap<String, SessionState>,
    /// legacy JSON fallback: newest message.json already consumed
    json_seen: Option<(PathBuf, i64)>,
}

#[derive(Debug)]
struct SessionState {
    title: String,
    last_input: i64,
    last_output: i64,
    last_updated: i64,
    /// Whether we've already reported this session as waiting on the user.
    waiting: bool,
}

#[derive(Debug)]
struct SessionRow {
    id: String,
    title: String,
    model: String,
    directory: String,
    time_updated: i64,
    tokens_input: i64,
    tokens_output: i64,
    archived: bool,
}

impl OpenCodeTracker {
    pub fn new(db_path: &str) -> Self {
        let db = if db_path.is_empty() {
            default_db_path()
        } else {
            Some(PathBuf::from(db_path))
        };
        Self {
            db,
            sessions: HashMap::new(),
            json_seen: None,
        }
    }

    pub fn poll(&mut self, tx: &EventSender) {
        let db = match &self.db {
            Some(db) if db.exists() => db.clone(),
            _ => {
                tracing::debug!("opencode: no db, using json fallback");
                self.poll_json(tx);
                return;
            }
        };
        if let Err(err) = self.poll_sqlite(tx, &db) {
            tracing::debug!(%err, "opencode: sqlite poll failed, using json fallback");
            self.poll_json(tx);
        }
    }

    /// Full-session tracking from the `session` table. `agent.started` on first
    /// sighting of an active session, `agent.token_usage` from cumulative-token
    /// deltas, `agent.summary` (title) + `agent.stopped` when the session goes
    /// idle or is archived.
    fn poll_sqlite(&mut self, tx: &EventSender, db: &Path) -> Result<()> {
        let conn = Connection::open_with_flags(db, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;
        let mut stmt = conn.prepare(
            "SELECT id, title, model, directory, time_updated, \
             tokens_input, tokens_output, time_archived \
             FROM session ORDER BY time_updated DESC LIMIT 500",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(SessionRow {
                id: row.get(0)?,
                title: row.get(1)?,
                model: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                directory: row.get(3)?,
                time_updated: row.get(4)?,
                tokens_input: row.get(5)?,
                tokens_output: row.get(6)?,
                archived: row
                    .get::<_, Option<i64>>(7)?
                    .map(|a| a != 0)
                    .unwrap_or(false),
            })
        })?;

        let now = chrono::Utc::now().timestamp_millis();
        let mut seen: HashSet<String> = HashSet::new();
        for row in rows {
            let row = row?;
            seen.insert(row.id.clone());
            let active = !row.archived && now - row.time_updated < IDLE_TIMEOUT_MS;
            if let Some(state) = self.sessions.get_mut(&row.id) {
                if active {
                    let (input_delta, output_delta) = token_deltas(state, &row);
                    if input_delta > 0 || output_delta > 0 {
                        let (model, provider) = parse_model(&row.model);
                        tracing::debug!(session = %row.id, input_delta, output_delta, "opencode: emitting token usage");
                        crate::bus::try_send(
                            tx,
                            TelemetryEvent::AgentTokenUsage {
                                timestamp: now_rfc3339(),
                                session_id: row.id.clone(),
                                provider,
                                model,
                                input_tokens: input_delta as u64,
                                output_tokens: output_delta as u64,
                                cached_input_tokens: None,
                            },
                        );
                        state.last_input = row.tokens_input;
                        state.last_output = row.tokens_output;
                    }
                    state.last_updated = row.time_updated;

                    // Stalled-while-running ⇒ waiting on the user.
                    let stalled = now - row.time_updated > STALLED_MS;
                    if stalled && !state.waiting {
                        state.waiting = true;
                        crate::bus::try_send(
                            tx,
                            TelemetryEvent::AgentStatus {
                                timestamp: now_rfc3339(),
                                session_id: row.id.clone(),
                                status: "waiting_approval".into(),
                            },
                        );
                    } else if !stalled && state.waiting {
                        state.waiting = false;
                        crate::bus::try_send(
                            tx,
                            TelemetryEvent::AgentStatus {
                                timestamp: now_rfc3339(),
                                session_id: row.id.clone(),
                                status: "running".into(),
                            },
                        );
                    }
                } else {
                    emit_stopped(tx, &row.id, &state.title);
                    self.sessions.remove(&row.id);
                }
            } else if active {
                let repository = project_repo(&row.directory);
                let branch = directory_branch(&row.directory);
                let stalled_at_birth = now - row.time_updated > STALLED_MS;
                let (model, _) = parse_model(&row.model);
                tracing::debug!(session = %row.id, model = %model, "opencode: emitting started");
                crate::bus::try_send(
                    tx,
                    TelemetryEvent::AgentStarted {
                        timestamp: now_rfc3339(),
                        session_id: row.id.clone(),
                        agent: "opencode".into(),
                        model: Some(model),
                        version: None,
                        title: Some(row.title.clone()),
                        repository,
                        branch,
                    },
                );
                if stalled_at_birth {
                    crate::bus::try_send(
                        tx,
                        TelemetryEvent::AgentStatus {
                            timestamp: now_rfc3339(),
                            session_id: row.id.clone(),
                            status: "waiting_approval".into(),
                        },
                    );
                }
                self.sessions.insert(
                    row.id.clone(),
                    SessionState {
                        title: row.title,
                        last_input: row.tokens_input,
                        last_output: row.tokens_output,
                        last_updated: row.time_updated,
                        waiting: stalled_at_birth,
                    },
                );
            }
        }

        // Sessions no longer in the recent set were archived, pruned, or went
        // idle long ago — close them out.
        let stale: Vec<(String, String)> = self
            .sessions
            .iter()
            .filter(|(id, _)| !seen.contains(*id))
            .map(|(id, s)| (id.clone(), s.title.clone()))
            .collect();
        for (id, title) in stale {
            emit_stopped(tx, &id, &title);
            self.sessions.remove(&id);
        }
        Ok(())
    }

    /// Legacy fallback for opencode versions that write `message.json` files:
    /// emit `agent.token_usage` for the newest assistant message once.
    fn poll_json(&mut self, tx: &EventSender) {
        let Some(home) = home_dir() else {
            return;
        };
        let base = home
            .join(".local")
            .join("share")
            .join("opencode")
            .join("project");
        let Ok(projects) = std::fs::read_dir(&base) else {
            return;
        };
        let mut newest: Option<(PathBuf, i64)> = None;
        for project in projects.flatten() {
            let storage = project.path().join("storage");
            let Ok(sessions) = std::fs::read_dir(&storage) else {
                continue;
            };
            for session in sessions.flatten() {
                let message_dir = session.path().join("message");
                let Ok(messages) = std::fs::read_dir(&message_dir) else {
                    continue;
                };
                for msg_dir in messages.flatten() {
                    let candidate = msg_dir.path().join("message.json");
                    if !candidate.exists() {
                        continue;
                    }
                    let mtime = mtime_ms(&candidate);
                    if newest.as_ref().map(|(_, t)| mtime > *t).unwrap_or(true) {
                        newest = Some((candidate, mtime));
                    }
                }
            }
        }

        let Some((path, mtime)) = newest else {
            return;
        };
        if self
            .json_seen
            .as_ref()
            .map(|(p, t)| p == &path && t == &mtime)
            .unwrap_or(false)
        {
            return;
        }
        if let Some(event) = parse_opencode_json(&path) {
            crate::bus::try_send(tx, event);
        }
        self.json_seen = Some((path, mtime));
    }
}

fn default_db_path() -> Option<PathBuf> {
    std::env::var("HOME")
        .ok()
        .map(|h| PathBuf::from(h).join(".local/share/opencode/opencode.db"))
}

fn home_dir() -> Option<PathBuf> {
    std::env::var("HOME").ok().map(PathBuf::from)
}

fn provider_of(model: &str) -> String {
    match model.split_once('/') {
        Some((provider, _)) if !provider.is_empty() => provider.to_string(),
        _ => "opencode".to_string(),
    }
}

/// opencode stores `model` as a JSON string like
/// `{"id":"deepseek-v4-flash-free","providerID":"opencode"}`. Returns
/// `(model_id, provider)`, falling back to the raw string for plain names.
fn parse_model(model: &str) -> (String, String) {
    if let Ok(value) = serde_json::from_str::<Value>(model) {
        if let (Some(id), Some(provider)) = (
            value.get("id").and_then(|v| v.as_str()),
            value.get("providerID").and_then(|v| v.as_str()),
        ) {
            return (id.to_string(), provider.to_string());
        }
    }
    let provider = provider_of(model);
    if model.is_empty() {
        ("opencode".to_string(), provider)
    } else {
        (model.to_string(), provider)
    }
}

fn token_deltas(state: &SessionState, row: &SessionRow) -> (i64, i64) {
    (
        (row.tokens_input - state.last_input).max(0),
        (row.tokens_output - state.last_output).max(0),
    )
}

fn directory_repo(directory: &str) -> Option<String> {
    Path::new(directory)
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
}

/// Repo slug (`owner/name`) resolved from the session directory's git remote,
/// falling back to the folder name.
fn project_repo(directory: &str) -> Option<String> {
    if let Ok(repo) = git2::Repository::discover(directory) {
        if let Ok(origin) = repo.find_remote("origin") {
            if let Some(url) = origin.url() {
                if let Some(slug) = crate::modules::git::remote_slug(url) {
                    return Some(slug);
                }
            }
        }
    }
    directory_repo(directory)
}

fn directory_branch(directory: &str) -> Option<String> {
    let repo = git2::Repository::open(directory).ok()?;
    let head = repo.find_reference("HEAD").ok()?;
    let target = head
        .symbolic_target()
        .or_else(|| head.name())
        .map(String::from)?;
    target.strip_prefix("refs/heads/").map(|s| s.to_string())
}

fn emit_stopped(tx: &EventSender, session_id: &str, title: &str) {
    if !title.is_empty() {
        crate::bus::try_send(
            tx,
            TelemetryEvent::AgentSummary {
                timestamp: now_rfc3339(),
                session_id: session_id.to_string(),
                summary: title.to_string(),
            },
        );
    }
    crate::bus::try_send(
        tx,
        TelemetryEvent::AgentStopped {
            timestamp: now_rfc3339(),
            session_id: session_id.to_string(),
            status: "stopped".to_string(),
        },
    );
}

fn mtime_ms(path: &Path) -> i64 {
    path.metadata()
        .and_then(|m| m.modified())
        .map(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0)
        })
        .unwrap_or(0)
}

/// Parses an opencode `message.json` (assistant) into a token-usage event.
fn parse_opencode_json(path: &Path) -> Option<TelemetryEvent> {
    let raw = std::fs::read_to_string(path).ok()?;
    let value: Value = serde_json::from_str(&raw).ok()?;
    if value.get("role").and_then(|v| v.as_str()) != Some("assistant") {
        return None;
    }
    let session_id = value
        .get("sessionID")
        .and_then(|v| v.as_str())
        .or_else(|| value.get("session_id").and_then(|v| v.as_str()))?;
    let tokens = value.pointer("/info/tokens")?;
    let input_tokens = tokens.get("input").and_then(|v| v.as_u64()).unwrap_or(0);
    let output_tokens = tokens.get("output").and_then(|v| v.as_u64()).unwrap_or(0);
    let model = value
        .pointer("/info/model/model")
        .and_then(|v| v.as_str())
        .unwrap_or("opencode")
        .to_string();
    let provider = value
        .pointer("/info/model/provider")
        .and_then(|v| v.as_str())
        .unwrap_or("opencode")
        .to_string();
    Some(TelemetryEvent::AgentTokenUsage {
        timestamp: now_rfc3339(),
        session_id: session_id.to_string(),
        provider,
        model,
        input_tokens,
        output_tokens,
        cached_input_tokens: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bus;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn now_ms() -> i64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64
    }

    fn row(id: &str, input: i64, output: i64, updated_ago_ms: i64) -> SessionRow {
        SessionRow {
            id: id.into(),
            title: format!("Session {id}"),
            model: "anthropic/claude-sonnet".into(),
            directory: "/Users/dev/acme".into(),
            time_updated: now_ms() - updated_ago_ms,
            tokens_input: input,
            tokens_output: output,
            archived: false,
        }
    }

    #[test]
    fn provider_of_extracts_model_prefix() {
        assert_eq!(provider_of("anthropic/claude-sonnet"), "anthropic");
        assert_eq!(provider_of("openai/gpt-5"), "openai");
        assert_eq!(provider_of("gpt-5"), "opencode");
        assert_eq!(provider_of(""), "opencode");
    }

    #[test]
    fn parse_model_extracts_json_id_and_provider() {
        assert_eq!(
            parse_model(
                r#"{"id":"deepseek-v4-flash-free","providerID":"opencode","variant":"default"}"#
            ),
            ("deepseek-v4-flash-free".into(), "opencode".into())
        );
        assert_eq!(
            parse_model("anthropic/claude-sonnet"),
            ("anthropic/claude-sonnet".into(), "anthropic".into())
        );
    }

    #[test]
    fn token_deltas_are_non_negative() {
        let state = SessionState {
            title: "t".into(),
            last_input: 10,
            last_output: 5,
            last_updated: now_ms(),
            waiting: false,
        };
        assert_eq!(token_deltas(&state, &row("s", 13, 9, 0)), (3, 4));
        assert_eq!(token_deltas(&state, &row("s", 8, 9, 0)), (0, 4));
    }

    #[test]
    fn directory_repo_is_basename() {
        assert_eq!(
            directory_repo("/Users/dev/acme/repo").as_deref(),
            Some("repo")
        );
        assert_eq!(directory_repo("/"), None);
    }

    #[test]
    fn directory_branch_resolves_git_head() {
        let dir = std::env::temp_dir().join(format!("hive-opencode-branch-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let repo = git2::Repository::init(&dir).unwrap();
        repo.set_head("refs/heads/issue/123-fix").unwrap();
        assert_eq!(
            directory_branch(&dir.to_string_lossy()).as_deref(),
            Some("issue/123-fix")
        );
        assert_eq!(directory_branch("/nonexistent-dir"), None);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn sqlite_poll_emits_started_usage_and_stopped() {
        let dir = std::env::temp_dir().join(format!("hive-opencode-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let db = dir.join("opencode.db");

        {
            let conn = Connection::open(&db).unwrap();
            conn.execute_batch(
                "CREATE TABLE session (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    directory TEXT NOT NULL,
                    model TEXT,
                    time_updated INTEGER NOT NULL,
                    tokens_input INTEGER DEFAULT 0 NOT NULL,
                    tokens_output INTEGER DEFAULT 0 NOT NULL,
                    time_archived INTEGER
                );",
            )
            .unwrap();
            conn.execute(
                "INSERT INTO session (id, title, directory, model, time_updated, tokens_input, tokens_output)
                 VALUES ('s1', 'Fix auth', '/Users/dev/acme', 'anthropic/claude-sonnet', ?, 100, 50)",
                [now_ms()],
            )
            .unwrap();
        }

        let (tx, rx) = bus::channel();
        let mut tracker = OpenCodeTracker::new(db.to_str().unwrap());
        tracker.poll(&tx);
        let started = drain(rx);
        assert!(started.iter().any(
            |e| matches!(e, TelemetryEvent::AgentStarted { agent, .. } if agent == "opencode")
        ));

        {
            let conn = Connection::open(&db).unwrap();
            conn.execute(
                "UPDATE session SET tokens_input = 130, tokens_output = 60, time_updated = ? WHERE id = 's1'",
                [now_ms()],
            )
            .unwrap();
        }
        let (tx, rx) = bus::channel();
        tracker.poll(&tx);
        let usage = drain(rx);
        assert!(
            usage.iter().any(
                |e| matches!(e, TelemetryEvent::AgentTokenUsage { input_tokens, output_tokens, .. } if *input_tokens == 30 && *output_tokens == 10)
            ),
            "expected delta usage, got {usage:?}"
        );

        {
            let conn = Connection::open(&db).unwrap();
            conn.execute(
                "UPDATE session SET time_updated = ? WHERE id = 's1'",
                [now_ms() - IDLE_TIMEOUT_MS - 60_000],
            )
            .unwrap();
        }
        let (tx, rx) = bus::channel();
        tracker.poll(&tx);
        let stopped = drain(rx);
        assert!(
            stopped
                .iter()
                .any(|e| matches!(e, TelemetryEvent::AgentStopped { .. }))
        );
        assert!(stopped.iter().any(
            |e| matches!(e, TelemetryEvent::AgentSummary { summary, .. } if summary == "Fix auth")
        ));

        std::fs::remove_dir_all(&dir).ok();
    }

    fn drain(mut rx: bus::EventReceiver) -> Vec<TelemetryEvent> {
        let mut out = Vec::new();
        while let Ok(event) = rx.try_recv() {
            out.push(event);
        }
        out
    }
}
