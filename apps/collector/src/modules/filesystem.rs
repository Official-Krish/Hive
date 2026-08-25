use crate::bus::EventSender;
use crate::config::{Config, first_watch_path};
use crate::events::{TelemetryEvent, now_rfc3339};
use anyhow::Context;
use notify::{Event, EventKind, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::Path;
use std::time::Duration;
use tokio::sync::watch;

const IGNORED_SEGMENTS: &[&str] = &[
    ".git",
    ".hg",
    ".svn",
    "node_modules",
    "target",
    "dist",
    "build",
    ".next",
    ".nuxt",
    ".cache",
    "Pods",
];
const DEBOUNCE_MS: i64 = 300;

fn should_ignore(path: &Path) -> bool {
    path.components()
        .any(|c| IGNORED_SEGMENTS.contains(&c.as_os_str().to_string_lossy().as_ref()))
}

/// Watches the configured repo directories and emits `file.modified` events.
/// The notify handler runs on a dedicated std thread (notify's contract) and
/// forwards into the async event channel.
pub fn spawn(
    tx: EventSender,
    config: Config,
    mut shutdown: watch::Receiver<bool>,
) -> anyhow::Result<()> {
    let Some(root_path) = first_watch_path(&config).map(Path::new) else {
        tracing::info!("no watch paths configured; filesystem watcher idle");
        return Ok(());
    };
    let root = root_path.to_path_buf();
    if !root.is_dir() {
        anyhow::bail!("watch path is not a directory: {}", root.display());
    }

    let (std_tx, std_rx) = std::sync::mpsc::channel::<Event>();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<Event>| {
        if let Ok(event) = res {
            let _ = std_tx.send(event);
        }
    })
    .context("failed to create filesystem watcher")?;
    watcher
        .watch(&root, RecursiveMode::Recursive)
        .with_context(|| format!("failed to watch {}", root.display()))?;

    let tx_thread = tx.clone();
    std::thread::spawn(move || {
        let repo_name = root
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| root.to_string_lossy().to_string());
        let mut last_emit: HashMap<String, i64> = HashMap::new();
        for event in std_rx {
            if let EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_) = event.kind {
                for path in event.paths {
                    if should_ignore(&path) {
                        continue;
                    }
                    let now = chrono::Utc::now().timestamp_millis();
                    let key = path.to_string_lossy().to_string();
                    if now - last_emit.get(&key).copied().unwrap_or(0) < DEBOUNCE_MS {
                        continue;
                    }
                    last_emit.insert(key.clone(), now);
                    let rel = path.strip_prefix(&root).unwrap_or(&path);
                    let change_type = match event.kind {
                        EventKind::Create(_) => Some("created".to_string()),
                        EventKind::Remove(_) => Some("deleted".to_string()),
                        _ => Some("modified".to_string()),
                    };
                    let telemetry = TelemetryEvent::FileModified {
                        timestamp: now_rfc3339(),
                        path: rel.to_string_lossy().to_string(),
                        repository: Some(repo_name.clone()),
                        branch: None,
                        change_type,
                    };
                    crate::bus::try_send(&tx_thread, telemetry);
                }
            }
        }
    });

    // Keep the watcher alive until shutdown; notify stops watching when the
    // guard drops, so we move it into a task that parks until shutdown.
    tokio::spawn(async move {
        let _watcher = watcher;
        loop {
            tokio::select! {
                _ = shutdown.changed() => {
                    if *shutdown.borrow() {
                        break;
                    }
                }
                _ = tokio::time::sleep(Duration::from_secs(1)) => {}
            }
        }
        tracing::info!("filesystem watcher stopped");
    });

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filters_ignored_paths() {
        assert!(should_ignore(Path::new("/repo/.git/config")));
        assert!(should_ignore(Path::new("/repo/node_modules/x/index.js")));
        assert!(should_ignore(Path::new("/repo/target/debug/app")));
        assert!(!should_ignore(Path::new("/repo/src/main.rs")));
    }
}
