use crate::status::{read_status, write_status};
use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use std::time::Duration;
use tokio::sync::watch;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::{Error as WsError, Message};

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(30);
const RECONNECT_BACKOFF: Duration = Duration::from_secs(3);

#[derive(Debug, PartialEq)]
enum SessionEnd {
    CommandShutdown,
    Unauthorized,
    Disconnected,
}

/// Maintains the persistent control-channel WebSocket to
/// `{ws_url}/ws/device?token=…`. Receives `control.shutdown` commands from
/// the backend (frontend "Stop" button) and reflects connection state in
/// `status.json`. Reconnects with backoff on drops.
pub async fn run(
    ws_url: String,
    device_token: String,
    shutdown_tx: watch::Sender<bool>,
) -> Result<(), anyhow::Error> {
    loop {
        match connect_once(&ws_url, &device_token, &shutdown_tx).await {
            SessionEnd::CommandShutdown => {
                tracing::info!("received control.shutdown; stopping");
                let _ = shutdown_tx.send(true);
                return Ok(());
            }
            SessionEnd::Unauthorized => {
                let mut status = read_status();
                status.connected = false;
                status.error = Some("device token rejected by control channel".into());
                let _ = write_status(&status);
                tracing::error!("control channel rejected device token");
                return Err(anyhow::anyhow!("device token rejected"));
            }
            SessionEnd::Disconnected => {
                if *shutdown_tx.borrow() {
                    return Ok(());
                }
                tracing::warn!("control channel dropped; reconnecting");
                tokio::time::sleep(RECONNECT_BACKOFF).await;
            }
        }
    }
}

async fn connect_once(
    ws_url: &str,
    device_token: &str,
    shutdown_tx: &watch::Sender<bool>,
) -> SessionEnd {
    let url = format!(
        "{}/ws/device?token={}",
        ws_url.trim_end_matches('/'),
        urlencoding(device_token)
    );

    let (mut ws, _) = match connect_async(&url).await {
        Ok(conn) => conn,
        Err(WsError::Http(response)) if response.status().as_u16() == 401 => {
            return SessionEnd::Unauthorized;
        }
        Err(err) => {
            tracing::warn!(%err, "control channel connect failed");
            return SessionEnd::Disconnected;
        }
    };

    set_connected(true);
    tracing::info!("control channel connected");

    let mut heartbeat = tokio::time::interval(HEARTBEAT_INTERVAL);
    heartbeat.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    loop {
        tokio::select! {
            _ = heartbeat.tick() => {
                let msg = serde_json::json!({
                    "type": "heartbeat",
                    "timestamp": chrono::Utc::now().timestamp_millis(),
                });
                if ws.send(Message::Text(msg.to_string().into())).await.is_err() {
                    break;
                }
            }
            incoming = ws.next() => match incoming {
                None => break,
                Some(Err(_)) => break,
                Some(Ok(Message::Text(text))) => {
                    if let Some(end) = handle_message(&text).await {
                        return end;
                    }
                }
                Some(Ok(_)) => {}
            },
        }
    }

    set_connected(false);
    tracing::info!("control channel closed");
    if *shutdown_tx.borrow() {
        SessionEnd::CommandShutdown
    } else {
        SessionEnd::Disconnected
    }
}

async fn handle_message(text: &str) -> Option<SessionEnd> {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(text) else {
        return None;
    };
    if value.get("type").and_then(|v| v.as_str()) != Some("control") {
        return None;
    }
    match value.get("cmd").and_then(|v| v.as_str()) {
        Some("shutdown") => Some(SessionEnd::CommandShutdown),
        Some("ping") => {
            set_connected(true);
            None
        }
        Some("reconnect") => Some(SessionEnd::Disconnected),
        _ => None,
    }
}

fn set_connected(connected: bool) {
    let mut status = read_status();
    status.connected = connected;
    if connected {
        status.error = None;
        status.last_seen_at = Some(chrono::Utc::now().to_rfc3339());
    }
    let _ = write_status(&status);
}

fn urlencoding(input: &str) -> String {
    let mut out = String::new();
    for byte in input.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            out.push(byte as char);
        } else {
            out.push_str(&format!("%{byte:02X}"));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn urlencodes_tokens() {
        assert_eq!(urlencoding("abc-123"), "abc-123");
        assert_eq!(urlencoding("a b"), "a%20b");
        assert_eq!(urlencoding("hive_dev_x"), "hive_dev_x");
    }

    #[test]
    fn parses_shutdown_command() {
        let result = tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(handle_message("{\"type\":\"control\",\"cmd\":\"shutdown\",\"timestamp\":1}"));
        assert_eq!(result, Some(SessionEnd::CommandShutdown));
    }

    #[test]
    fn ignores_non_control_messages() {
        let result = tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(handle_message("{\"type\":\"hello\"}"));
        assert_eq!(result, None);
    }
}