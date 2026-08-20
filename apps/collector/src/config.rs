use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct WatchDir {
    pub path: String,
    pub enabled: bool,
}

impl Default for WatchDir {
    fn default() -> Self {
        Self {
            path: String::new(),
            enabled: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Config {
    pub api_url: String,
    pub ws_url: String,
    pub device_id: String,
    pub device_token: String,
    pub workspace_id: String,
    pub poll_interval_ms: u64,
    pub git_poll_interval_ms: u64,
    pub flush_interval_ms: u64,
    pub flush_max_events: usize,
    #[serde(skip)]
    pub path: PathBuf,
    pub watch: Vec<WatchDir>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            api_url: API_URL.into(),
            ws_url: WS_URL.into(),
            device_id: String::new(),
            device_token: String::new(),
            workspace_id: String::new(),
            poll_interval_ms: 2_000,
            git_poll_interval_ms: 5_000,
            flush_interval_ms: 5_000,
            flush_max_events: 200,
            path: PathBuf::new(),
            watch: Vec::new(),
        }
    }
}

/// Local backend HTTP base the collector talks to (hardcoded so install/login
/// need no prompt). Change here if your backend runs on another port.
pub const API_URL: &str = "http://localhost:3000";

/// Local backend realtime base; install overrides this from `/api/v1/health`.
pub const WS_URL: &str = "ws://localhost:4001";

/// GitHub OAuth endpoints for the device flow (`hive login`). The client id is
/// public and comes from the backend's `/api/v1/health`; only the user's token is
/// exchanged with the backend, never a secret.
pub const GITHUB_LOGIN_BASE: &str = "https://github.com";
pub const GITHUB_SCOPE: &str = "read:user user:email";

pub fn github_device_code_url() -> String {
    format!("{GITHUB_LOGIN_BASE}/login/device/code")
}

pub fn github_oauth_token_url() -> String {
    format!("{GITHUB_LOGIN_BASE}/login/oauth/access_token")
}

impl Config {
    pub fn is_configured(&self) -> bool {
        !self.device_id.is_empty()
            && !self.device_token.is_empty()
            && !self.workspace_id.is_empty()
    }

    pub fn load() -> Result<Self> {
        let path = config_path();
        if !path.exists() {
            return Ok(Self {
                path,
                ..Self::default()
            });
        }
        let raw = fs::read_to_string(&path).with_context(|| {
            format!("failed to read config at {}", path.display())
        })?;
        let mut config: Config = toml::from_str(&raw)
            .with_context(|| format!("invalid TOML in {}", path.display()))?;
        config.path = path;
        Ok(config)
    }

    pub fn save(&self) -> Result<()> {
        let path = config_path();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("failed to create {}", parent.display()))?;
        }
        let toml = toml::to_string_pretty(self)
            .context("failed to serialize config")?;
        fs::write(&path, toml)
            .with_context(|| format!("failed to write {}", path.display()))
    }

    pub fn set(&mut self, key: &str, value: &str) -> Result<()> {
        match key {
            "api_url" => self.api_url = value.trim().to_string(),
            "ws_url" => self.ws_url = value.trim().to_string(),
            "device_id" => self.device_id = value.trim().to_string(),
            "device_token" => self.device_token = value.trim().to_string(),
            "workspace_id" => self.workspace_id = value.trim().to_string(),
            "poll_interval_ms" => self.poll_interval_ms = value.trim().parse()?,
            "git_poll_interval_ms" => self.git_poll_interval_ms = value.trim().parse()?,
            _ => bail!("unknown config key: {key}"),
        }
        Ok(())
    }

    pub fn add_watch(&mut self, path: &str) -> Result<()> {
        let canonical = fs::canonicalize(path)
            .with_context(|| format!("path does not exist: {path}"))?;
        if !canonical.is_dir() {
            bail!("not a directory: {path}");
        }
        if self.watch.iter().any(|w| w.path == path) {
            return Ok(());
        }
        self.watch.push(WatchDir {
            path: path.to_string(),
            enabled: true,
        });
        Ok(())
    }
}

/// `~/.config/hive/config.toml`
pub fn config_path() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home).join(".config").join("hive").join("config.toml");
    }
    PathBuf::from("hive.toml")
}

/// `~/.local/state/hive` (XDG state dir; `~/.hive` on macOS).
pub fn state_dir() -> PathBuf {
    let base = dirs_state();
    base
}

fn dirs_state() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home).join(".local").join("state").join("hive");
    }
    PathBuf::from(".hive")
}

pub fn pidfile_path() -> PathBuf {
    state_dir().join("collector.pid")
}

pub fn status_path() -> PathBuf {
    state_dir().join("status.json")
}

pub fn log_path() -> PathBuf {
    state_dir().join("collector.log")
}

pub fn db_path() -> PathBuf {
    state_dir().join("outbox.db")
}

pub fn ensure_state_dir() -> Result<()> {
    fs::create_dir_all(state_dir())
        .with_context(|| format!("failed to create {}", state_dir().display()))
}

pub fn first_watch_path(config: &Config) -> Option<&str> {
    config
        .watch
        .iter()
        .find(|w| w.enabled && !w.path.is_empty())
        .map(|w| w.path.as_str())
}

pub fn config_is_dir(p: &Path) -> bool {
    p.is_dir()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_unconfigured() {
        let cfg = Config::default();
        assert!(!cfg.is_configured());
        assert_eq!(cfg.api_url, API_URL);
    }

    #[test]
    fn set_known_keys() {
        let mut cfg = Config::default();
        cfg.set("device_id", "dev-1").unwrap();
        cfg.set("workspace_id", "ws-1").unwrap();
        cfg.set("device_token", "hive_dev_x").unwrap();
        assert!(cfg.is_configured());
    }

    #[test]
    fn rejects_unknown_key() {
        let mut cfg = Config::default();
        assert!(cfg.set("nope", "x").is_err());
    }

    #[test]
    fn round_trips_toml() {
        let mut cfg = Config::default();
        cfg.device_id = "d".into();
        cfg.workspace_id = "w".into();
        cfg.watch.push(WatchDir {
            path: "/tmp/x".into(),
            enabled: true,
        });
        let raw = toml::to_string(&cfg).unwrap();
        let parsed: Config = toml::from_str(&raw).unwrap();
        assert_eq!(parsed.device_id, "d");
        assert_eq!(parsed.watch.len(), 1);
    }
}