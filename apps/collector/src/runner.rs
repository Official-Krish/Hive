use crate::config::{Config, db_path, ensure_state_dir};
use crate::control;
use crate::daemon::{mark_stopped, write_pidfile};
use crate::flusher;
use crate::status::{read_status, write_status};
use crate::storage::Outbox;
use anyhow::{Context, Result};
use std::sync::Arc;
use tokio::signal::unix::{SignalKind, signal};

pub async fn run() -> Result<()> {
    let config = Config::load()?;
    if !config.is_configured() {
        anyhow::bail!(
            "collector is not configured. Run `hive install` for one-time setup, or set \
             device_id, device_token, and workspace_id manually with `hive config set …`."
        );
    }
    if config.watch.is_empty() {
        tracing::warn!("no watch paths configured; add one with `hive config add-watch <path>`");
    }

    ensure_state_dir()?;
    write_pidfile(std::process::id())?;
    let mut status = read_status();
    status.running = true;
    status.connected = false;
    status.error = None;
    write_status(&status)?;

    let outbox = Arc::new(Outbox::open(&db_path())?);
    let (tx, rx) = crate::bus::channel();
    let (shutdown_tx, mut shutdown_rx) = tokio::sync::watch::channel(false);

    // SIGTERM (hive stop / process manager) and SIGINT (Ctrl-C) both trigger
    // the same graceful shutdown as a control.shutdown command.
    let mut sigterm =
        signal(SignalKind::terminate()).context("failed to install SIGTERM handler")?;
    let mut sigint = signal(SignalKind::interrupt()).context("failed to install SIGINT handler")?;

    let modules = crate::modules::spawn_all(tx.clone(), config.clone(), shutdown_rx.clone()).await;

    let flusher_task = tokio::spawn(flusher::run(
        rx,
        config.clone(),
        outbox.clone(),
        shutdown_rx.clone(),
    ));
    let control_task = if config.ws_url.is_empty() || config.device_token.is_empty() {
        None
    } else {
        Some(tokio::spawn(control::run(
            config.ws_url.clone(),
            config.device_token.clone(),
            shutdown_tx.clone(),
        )))
    };

    let _ = modules;

    // Wait for a shutdown signal from the OS or from the control channel.
    let reason = tokio::select! {
        _ = sigterm.recv() => "SIGTERM",
        _ = sigint.recv() => "SIGINT",
        _ = shutdown_rx.changed() => "control",
    };
    tracing::info!("shutdown requested ({reason})");

    let _ = shutdown_tx.send(true);
    // Give the flusher a moment to drain pending events.
    let _ = tokio::time::timeout(std::time::Duration::from_secs(5), flusher_task).await;
    if let Some(task) = control_task {
        task.abort();
    }

    let queued = outbox.count().unwrap_or(0);
    if queued > 0 {
        tracing::warn!("{queued} batches remain in the outbox");
    }

    mark_stopped();
    Ok(())
}
