use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Status {
    pub running: bool,
    pub connected: bool,
    pub pid: Option<u32>,
    pub last_seen_at: Option<String>,
    pub queued: usize,
    pub error: Option<String>,
}

impl Default for Status {
    fn default() -> Self {
        Self {
            running: false,
            connected: false,
            pid: None,
            last_seen_at: None,
            queued: 0,
            error: None,
        }
    }
}

pub fn write_status(status: &Status) -> Result<()> {
    fs::create_dir_all(super::config::state_dir())?;
    let json = serde_json::to_string_pretty(status)?;
    fs::write(super::config::status_path(), json)?;
    Ok(())
}

pub fn read_status() -> Status {
    match fs::read_to_string(super::config::status_path()) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
        Err(_) => Status::default(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_round_trips() {
        let status = Status {
            running: true,
            connected: true,
            pid: Some(42),
            queued: 3,
            error: None,
            last_seen_at: Some("2026-01-01T00:00:00Z".into()),
        };
        let json = serde_json::to_string(&status).unwrap();
        let parsed: Status = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.pid, Some(42));
        assert_eq!(parsed.queued, 3);
    }
}
