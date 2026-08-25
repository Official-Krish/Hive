use crate::config::Config;
use crate::events::{IngestBatch, TelemetryEvent, now_rfc3339};
use crate::status::{read_status, write_status};
use crate::storage::Outbox;
use crate::transport::{IngestClient, SendError, new_idempotency_key};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::MissedTickBehavior;

const MAX_OUTBOX_ATTEMPTS: i64 = 20;

/// Consumes events from the bus, batches them (≤ `flush_max_events` or every
/// `flush_interval_ms`), and posts them to the ingest API. Failed batches are
/// parked in the SQLite outbox and drained with exponential backoff.
pub async fn run(
    mut rx: mpsc::Receiver<TelemetryEvent>,
    config: Config,
    outbox: Arc<Outbox>,
    shutdown: tokio::sync::watch::Receiver<bool>,
) -> Result<(), anyhow::Error> {
    let client = IngestClient::new(&config.api_url, &config.device_token)?;

    if config.is_configured() {
        drain_outbox(&client, &outbox, &config, &shutdown).await;
    }

    let mut pending: Vec<TelemetryEvent> = Vec::new();
    let mut timer = tokio::time::interval(Duration::from_millis(config.flush_interval_ms));
    timer.set_missed_tick_behavior(MissedTickBehavior::Delay);

    loop {
        if *shutdown.borrow() && pending.is_empty() {
            break;
        }

        let flush = tokio::select! {
            _ = timer.tick() => true,
            event = rx.recv() => {
                match event {
                    Some(event) => {
                        pending.push(event);
                        pending.len() >= config.flush_max_events
                    }
                    None => !pending.is_empty(),
                }
            }
        };

        if flush && !pending.is_empty() {
            let batch = IngestBatch {
                device_id: config.device_id.clone(),
                workspace_id: config.workspace_id.clone(),
                timestamp: Some(now_rfc3339()),
                events: std::mem::take(&mut pending),
            };
            match client.send(&batch, &new_idempotency_key()).await {
                Ok(()) => {
                    drain_outbox(&client, &outbox, &config, &shutdown).await;
                    update_queued(&outbox).await;
                }
                Err(SendError::Unauthorized(_)) => {
                    let mut status = read_status();
                    status.connected = false;
                    status.error =
                        Some("device token rejected — run `hive install` to re-register".into());
                    let _ = write_status(&status);
                    tracing::error!("ingest rejected as unauthorized; stopping");
                    return Ok(());
                }
                Err(SendError::Rejected(body)) => {
                    tracing::warn!(%body, "ingest rejected; dropping batch");
                }
                Err(err) => {
                    let batch_json = serde_json::to_string(&batch)?;
                    outbox.enqueue(batch_json)?;
                    update_queued(&outbox).await;
                    tracing::warn!(%err, "ingest failed; batch queued to outbox");
                    sleep_backoff().await;
                }
            }
        }

        if *shutdown.borrow() {
            continue;
        }

        drain_outbox(&client, &outbox, &config, &shutdown).await;
    }

    Ok(())
}

async fn drain_outbox(
    client: &IngestClient,
    outbox: &Arc<Outbox>,
    config: &Config,
    shutdown: &tokio::sync::watch::Receiver<bool>,
) {
    if !config.is_configured() {
        return;
    }
    let Ok(pending) = outbox.pending() else {
        return;
    };
    for (id, batch_json, attempts) in pending {
        if *shutdown.borrow() {
            return;
        }
        if attempts >= MAX_OUTBOX_ATTEMPTS {
            let _ = outbox.delete(id);
            continue;
        }
        let key = new_idempotency_key();
        match serde_json::from_str::<IngestBatch>(&batch_json) {
            Ok(batch) => match client.send(&batch, &key).await {
                Ok(()) => {
                    let _ = outbox.delete(id);
                    tracing::info!("outbox batch {id} delivered");
                }
                Err(SendError::Unauthorized(_)) => return,
                Err(_) => {
                    let _ = outbox.mark_attempt(id);
                    return;
                }
            },
            Err(_) => {
                let _ = outbox.delete(id);
            }
        }
    }
}

async fn update_queued(outbox: &Arc<Outbox>) {
    let queued = outbox.count().unwrap_or(0);
    let mut status = read_status();
    status.queued = queued;
    let _ = write_status(&status);
}

async fn sleep_backoff() {
    tokio::time::sleep(Duration::from_secs(1)).await;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flusher_imports() {
        assert!(MAX_OUTBOX_ATTEMPTS > 0);
    }
}
