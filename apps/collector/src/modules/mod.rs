pub mod agents;
pub mod filesystem;
pub mod git;
pub mod process;
pub mod terminal;

use crate::bus::EventSender;
use crate::config::Config;
use crate::events::TelemetryEvent;
use anyhow::Result;
use tokio::sync::watch;

/// Spawns all observation sources. Each source forwards normalized
/// `TelemetryEvent`s into the shared event channel for the flusher.
pub async fn spawn_all(
    tx: EventSender,
    config: Config,
    shutdown: watch::Receiver<bool>,
) -> Result<()> {
    let mut process_tracker = process::ProcessTracker::new();
    process_tracker.started(&tx, std::process::id(), "collector".to_string());
    tokio::spawn(process::spawn_tracker(process_tracker, tx.clone(), config.clone(), shutdown.clone()));

    if let Err(err) = filesystem::spawn(tx.clone(), config.clone(), shutdown.clone()) {
        tracing::warn!(%err, "filesystem watcher not started");
    }

    let git_watcher = git::GitWatcher::new();
    tokio::spawn(git::spawn_tracker(git_watcher, tx.clone(), config.clone(), shutdown.clone()));

    tokio::spawn(terminal::serve(tx.clone(), config.clone(), shutdown.clone()));

    tokio::spawn(agents::spawn_agents(tx.clone(), config.clone(), shutdown.clone()));

    Ok(())
}

/// Local privacy stub: the backend already applies per-workspace privacy
/// gating server-side. Kept as a hook for future local redaction.
#[allow(dead_code)]
pub fn redact(_event: &mut TelemetryEvent) {}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn spawn_all_with_no_watch_paths_is_ok() {
        let (tx, mut _rx) = crate::bus::channel();
        let (_stop_tx, shutdown) = watch::channel(false);
        let cfg = Config::default();
        let result = spawn_all(tx, cfg, shutdown).await;
        assert!(result.is_ok());
    }
}