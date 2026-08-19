use crate::bus::EventSender;
use crate::config::Config;
use crate::events::{now_rfc3339, TelemetryEvent};
use std::collections::HashMap;
use std::time::Duration;
use tokio::sync::watch;

/// Tracks processes we care about (started via terminal hooks or agents) and
/// emits `process.stopped` when they disappear. Avoids scanning the whole
/// process table on every poll.
pub struct ProcessTracker {
    tracked: HashMap<u32, i64>,
}

impl ProcessTracker {
    pub fn new() -> Self {
        Self {
            tracked: HashMap::new(),
        }
    }

    /// Record a process and emit `process.started`.
    pub fn started(
        &mut self,
        tx: &EventSender,
        pid: u32,
        command: String,
    ) {
        if self.tracked.contains_key(&pid) {
            return;
        }
        self.tracked.insert(pid, chrono::Utc::now().timestamp_millis());
        let event = TelemetryEvent::ProcessStarted {
            timestamp: now_rfc3339(),
            pid: pid as u64,
            ppid: None,
            name: None,
            command,
        };
        crate::bus::try_send(tx, event);
    }

    /// Check tracked pids; emit `process.stopped` for dead ones.
    pub fn poll(&mut self, tx: &EventSender) {
        let dead: Vec<u32> = self
            .tracked
            .keys()
            .copied()
            .filter(|pid| !pid_alive(*pid))
            .collect();
        for pid in dead {
            self.tracked.remove(&pid);
            let event = TelemetryEvent::ProcessStopped {
                timestamp: now_rfc3339(),
                pid: pid as u64,
                exit_code: None,
            };
            crate::bus::try_send(tx, event);
        }
    }

    pub fn len(&self) -> usize {
        self.tracked.len()
    }

    pub fn is_empty(&self) -> bool {
        self.tracked.is_empty()
    }
}

fn pid_alive(pid: u32) -> bool {
    unsafe { libc::kill(pid as i32, 0) == 0 }
}

/// Background task polling tracked processes for termination.
pub async fn spawn_tracker(
    mut tracker: ProcessTracker,
    tx: EventSender,
    config: Config,
    mut shutdown: watch::Receiver<bool>,
) {
    let mut interval = tokio::time::interval(Duration::from_millis(config.poll_interval_ms));
    loop {
        tokio::select! {
            _ = interval.tick() => {
                tracker.poll(&tx);
            }
            _ = shutdown.changed() => {
                if *shutdown.borrow() {
                    tracker.poll(&tx);
                    break;
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starts_and_tracks() {
        let (tx, mut rx) = crate::bus::channel();
        let mut tracker = ProcessTracker::new();
        tracker.started(&tx, u32::MAX, "ls".into());
        assert_eq!(tracker.len(), 1);
        let event = rx.try_recv().unwrap();
        assert!(matches!(event, TelemetryEvent::ProcessStarted { pid, .. } if pid == u32::MAX as u64));
    }
}
