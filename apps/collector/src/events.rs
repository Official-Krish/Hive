use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};

/// Current UTC time as an RFC3339 string, matching the backend's
/// `z.string().datetime()` ingest schema.
pub fn now_rfc3339() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

/// Every telemetry event the collector can emit. Mirrors the
/// `telemetryEventSchema` discriminated union in `@hive/events` — the
/// `type` tag and camelCase field names match the wire contract exactly.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum TelemetryEvent {
    #[serde(rename = "agent.started", rename_all = "camelCase")]
    AgentStarted {
        timestamp: String,
        session_id: String,
        agent: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        model: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        version: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        title: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        repository: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        branch: Option<String>,
    },
    #[serde(rename = "agent.stopped", rename_all = "camelCase")]
    AgentStopped {
        timestamp: String,
        session_id: String,
        status: String,
    },
    #[serde(rename = "agent.token_usage", rename_all = "camelCase")]
    AgentTokenUsage {
        timestamp: String,
        session_id: String,
        provider: String,
        model: String,
        input_tokens: u64,
        output_tokens: u64,
        #[serde(skip_serializing_if = "Option::is_none")]
        cached_input_tokens: Option<u64>,
    },
    #[serde(rename = "agent.summary", rename_all = "camelCase")]
    AgentSummary {
        timestamp: String,
        session_id: String,
        summary: String,
    },
    #[serde(rename = "activity.started", rename_all = "camelCase")]
    ActivityStarted {
        timestamp: String,
        activity_id: String,
        activity_type: String,
        title: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        summary: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        repository: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        branch: Option<String>,
    },
    #[serde(rename = "activity.updated", rename_all = "camelCase")]
    ActivityUpdated {
        timestamp: String,
        activity_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        status: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        summary: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        files_changed: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        lines_changed: Option<u64>,
    },
    #[serde(rename = "activity.stopped", rename_all = "camelCase")]
    ActivityStopped {
        timestamp: String,
        activity_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        outcome: Option<String>,
    },
    #[serde(rename = "git.commit", rename_all = "camelCase")]
    GitCommit {
        timestamp: String,
        repository: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        branch: Option<String>,
        sha: String,
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        author_email: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        authored_at: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        insertions: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        deletions: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        files_changed: Option<u64>,
    },
    #[serde(rename = "git.pull_request", rename_all = "camelCase")]
    GitPullRequest {
        timestamp: String,
        repository: String,
        number: u64,
        title: String,
        status: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        url: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        head_branch: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        base_branch: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        additions: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        deletions: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        commits: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        merged_at: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        closed_at: Option<String>,
    },
    #[serde(rename = "git.branch", rename_all = "camelCase")]
    GitBranch {
        timestamp: String,
        repository: String,
        name: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        last_commit_sha: Option<String>,
    },
    #[serde(rename = "test.started", rename_all = "camelCase")]
    TestStarted {
        timestamp: String,
        test_run_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        activity_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        repository: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        branch: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        command: Option<String>,
    },
    #[serde(rename = "test.finished", rename_all = "camelCase")]
    TestFinished {
        timestamp: String,
        test_run_id: String,
        status: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        total_tests: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        passed_tests: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        failed_tests: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        skipped_tests: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        duration_ms: Option<u64>,
    },
    #[serde(rename = "process.started", rename_all = "camelCase")]
    ProcessStarted {
        timestamp: String,
        pid: u64,
        #[serde(skip_serializing_if = "Option::is_none")]
        ppid: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        name: Option<String>,
        command: String,
    },
    #[serde(rename = "process.stopped", rename_all = "camelCase")]
    ProcessStopped {
        timestamp: String,
        pid: u64,
        #[serde(skip_serializing_if = "Option::is_none")]
        exit_code: Option<i32>,
    },
    #[serde(rename = "terminal.command", rename_all = "camelCase")]
    TerminalCommand {
        timestamp: String,
        command: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        pid: Option<u64>,
    },
    #[serde(rename = "file.modified", rename_all = "camelCase")]
    FileModified {
        timestamp: String,
        path: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        repository: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        branch: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        change_type: Option<String>,
    },
}

/// Batch envelope posted to `POST /api/v1/ingest/events`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestBatch {
    pub device_id: String,
    pub workspace_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
    pub events: Vec<TelemetryEvent>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_agent_started_with_snake_case_tag_and_camel_case_fields() {
        let event = TelemetryEvent::AgentStarted {
            timestamp: "2026-01-01T00:00:00.000Z".into(),
            session_id: "s1".into(),
            agent: "claude".into(),
            model: Some("claude-sonnet".into()),
            version: None,
            title: Some("Fix bug".into()),
            repository: Some("acme/app".into()),
            branch: Some("main".into()),
        };
        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["type"], "agent.started");
        assert_eq!(json["sessionId"], "s1");
        assert_eq!(json["agent"], "claude");
        assert_eq!(json["title"], "Fix bug");
        assert_eq!(json["repository"], "acme/app");
    }

    #[test]
    fn omits_none_option_fields_instead_of_null() {
        let event = TelemetryEvent::ProcessStarted {
            timestamp: "2026-01-01T00:00:00.000Z".into(),
            pid: 123,
            ppid: None,
            name: None,
            command: "bun test".into(),
        };
        let json = serde_json::to_value(&event).unwrap();
        assert!(json.get("ppid").is_none(), "ppid must be omitted, not null");
        assert!(json.get("name").is_none(), "name must be omitted, not null");
    }

    #[test]
    fn serializes_batch_with_camel_case_fields() {
        let batch = IngestBatch {
            device_id: "dev1".into(),
            workspace_id: "ws1".into(),
            timestamp: Some("2026-01-01T00:00:00.000Z".into()),
            events: vec![TelemetryEvent::ProcessStarted {
                timestamp: "2026-01-01T00:00:00.000Z".into(),
                pid: 123,
                ppid: None,
                name: None,
                command: "bun test".into(),
            }],
        };
        let json = serde_json::to_value(&batch).unwrap();
        assert_eq!(json["deviceId"], "dev1");
        assert_eq!(json["workspaceId"], "ws1");
        assert_eq!(json["events"][0]["type"], "process.started");
        assert_eq!(json["events"][0]["command"], "bun test");
    }

    #[test]
    fn round_trips_all_variants() {
        let events = vec![
            TelemetryEvent::AgentStarted {
                timestamp: now_rfc3339(),
                session_id: "s".into(),
                agent: "codex".into(),
                model: None,
                version: None,
                title: None,
                repository: None,
                branch: None,
            },
            TelemetryEvent::AgentStopped {
                timestamp: now_rfc3339(),
                session_id: "s".into(),
                status: "completed".into(),
            },
            TelemetryEvent::AgentTokenUsage {
                timestamp: now_rfc3339(),
                session_id: "s".into(),
                provider: "anthropic".into(),
                model: "claude".into(),
                input_tokens: 1,
                output_tokens: 2,
                cached_input_tokens: Some(3),
            },
            TelemetryEvent::AgentSummary {
                timestamp: now_rfc3339(),
                session_id: "s".into(),
                summary: "done".into(),
            },
            TelemetryEvent::ActivityStarted {
                timestamp: now_rfc3339(),
                activity_id: "a".into(),
                activity_type: "coding".into(),
                title: "t".into(),
                summary: None,
                repository: None,
                branch: None,
            },
            TelemetryEvent::ActivityUpdated {
                timestamp: now_rfc3339(),
                activity_id: "a".into(),
                status: Some("in_progress".into()),
                summary: None,
                files_changed: None,
                lines_changed: None,
            },
            TelemetryEvent::ActivityStopped {
                timestamp: now_rfc3339(),
                activity_id: "a".into(),
                outcome: Some("success".into()),
            },
            TelemetryEvent::GitCommit {
                timestamp: now_rfc3339(),
                repository: "repo".into(),
                branch: Some("main".into()),
                sha: "abc".into(),
                message: "msg".into(),
                author_email: Some("a@b.c".into()),
                authored_at: None,
                insertions: None,
                deletions: None,
                files_changed: None,
            },
            TelemetryEvent::GitPullRequest {
                timestamp: now_rfc3339(),
                repository: "repo".into(),
                number: 1,
                title: "PR".into(),
                status: "open".into(),
                url: None,
                head_branch: None,
                base_branch: None,
                additions: None,
                deletions: None,
                commits: None,
                merged_at: None,
                closed_at: None,
            },
            TelemetryEvent::GitBranch {
                timestamp: now_rfc3339(),
                repository: "repo".into(),
                name: "main".into(),
                last_commit_sha: None,
            },
            TelemetryEvent::TestStarted {
                timestamp: now_rfc3339(),
                test_run_id: "t".into(),
                activity_id: None,
                repository: None,
                branch: None,
                command: None,
            },
            TelemetryEvent::TestFinished {
                timestamp: now_rfc3339(),
                test_run_id: "t".into(),
                status: "passed".into(),
                total_tests: None,
                passed_tests: None,
                failed_tests: None,
                skipped_tests: None,
                duration_ms: None,
            },
            TelemetryEvent::ProcessStarted {
                timestamp: now_rfc3339(),
                pid: 1,
                ppid: None,
                name: None,
                command: "c".into(),
            },
            TelemetryEvent::ProcessStopped {
                timestamp: now_rfc3339(),
                pid: 1,
                exit_code: Some(0),
            },
            TelemetryEvent::TerminalCommand {
                timestamp: now_rfc3339(),
                command: "ls".into(),
                pid: None,
            },
            TelemetryEvent::FileModified {
                timestamp: now_rfc3339(),
                path: "/x.rs".into(),
                repository: Some("repo".into()),
                branch: None,
                change_type: Some("modified".into()),
            },
        ];
        let json = serde_json::to_value(&events).unwrap();
        let back: Vec<TelemetryEvent> = serde_json::from_value(json).unwrap();
        assert_eq!(back.len(), events.len());
    }
}
