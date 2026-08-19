use crate::events::TelemetryEvent;
use tokio::sync::mpsc;

pub const CHANNEL_CAPACITY: usize = 2048;

/// Internal event channel: observation sources publish events, the flusher
/// consumes and batches them. Sources that would exceed the buffer simply
/// drop the event (bounded memory) and log at debug level.
pub fn channel() -> (mpsc::Sender<TelemetryEvent>, mpsc::Receiver<TelemetryEvent>) {
    mpsc::channel(CHANNEL_CAPACITY)
}

pub type EventSender = mpsc::Sender<TelemetryEvent>;
pub type EventReceiver = mpsc::Receiver<TelemetryEvent>;

pub fn try_send(tx: &EventSender, event: TelemetryEvent) {
    if let Err(err) = tx.try_send(event) {
        tracing::debug!(%err, "event dropped (channel full)");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn events_flow_through_channel() {
        let (tx, mut rx) = channel();
        try_send(&tx, TelemetryEvent::ProcessStarted {
            timestamp: "2026-01-01T00:00:00.000Z".into(),
            pid: 1,
            ppid: None,
            name: None,
            command: "ls".into(),
        });
        let received = rx.recv().await.unwrap();
        assert!(matches!(received, TelemetryEvent::ProcessStarted { .. }));
    }
}