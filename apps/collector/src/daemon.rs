use crate::config::{ensure_state_dir, log_path, pidfile_path, state_dir};
use crate::status::{Status, read_status, write_status};
use anyhow::{Context, Result, bail};
use std::fs;
use std::os::unix::process::CommandExt;
use std::process::Command;
use std::time::{Duration, Instant};

pub fn write_pidfile(pid: u32) -> Result<()> {
    ensure_state_dir()?;
    fs::write(pidfile_path(), pid.to_string())
        .with_context(|| format!("failed to write {}", pidfile_path().display()))
}

pub fn read_pid() -> Result<Option<u32>> {
    let path = pidfile_path();
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path)?;
    Ok(raw.trim().parse::<u32>().ok())
}

pub fn remove_pidfile() {
    let _ = fs::remove_file(pidfile_path());
}

pub fn pid_alive(pid: u32) -> bool {
    // kill with signal 0 just probes for existence.
    unsafe { libc::kill(pid as i32, 0) == 0 }
}

pub fn signal(pid: u32, sig: i32) -> Result<()> {
    let ret = unsafe { libc::kill(pid as i32, sig) };
    if ret != 0 {
        bail!(
            "failed to signal pid {pid}: {}",
            std::io::Error::last_os_error()
        );
    }
    Ok(())
}

/// Detach from the controlling terminal and run `hive run` in the background.
pub fn spawn_detached() -> Result<u32> {
    let exe = std::env::current_exe().context("failed to resolve current executable")?;
    ensure_state_dir()?;
    let log = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path())?;
    let log_clone = log.try_clone()?;
    let devnull = fs::OpenOptions::new().read(true).open("/dev/null")?;

    let mut cmd = Command::new(exe);
    cmd.arg("run")
        .stdin(std::process::Stdio::from(devnull))
        .stdout(std::process::Stdio::from(log))
        .stderr(std::process::Stdio::from(log_clone));
    unsafe {
        cmd.pre_exec(|| {
            libc::setsid();
            Ok(())
        });
    }
    let child = cmd
        .spawn()
        .context("failed to spawn background collector")?;

    Ok(child.id())
}

/// `hive start`: spawn detached, wait for it to register its pid.
pub fn start() -> Result<u32> {
    let config = crate::config::Config::load()?;
    if !config.is_configured() {
        bail!("collector is not configured. Run `hive install` for one-time setup first.");
    }
    if let Some(pid) = read_pid()? {
        if pid_alive(pid) {
            bail!("collector is already running (pid {pid})");
        }
        remove_pidfile();
    }

    let pid = spawn_detached()?;
    let deadline = Instant::now() + Duration::from_secs(5);
    while Instant::now() < deadline {
        if let Some(written) = read_pid()? {
            if pid_alive(written) {
                let mut status = read_status();
                status.running = true;
                write_status(&status)?;
                return Ok(written);
            }
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    bail!(
        "collector failed to start (pid {pid}); see {}",
        log_path().display()
    );
}

/// Spawn the daemon unless a healthy one is already tracked. Used by
/// `hive install` (which should leave the machine collecting telemetry) and by
/// `hive start` after an in-place re-registration.
pub fn ensure_running() -> Result<u32> {
    if let Some(pid) = read_pid()? {
        if pid_alive(pid) {
            return Ok(pid);
        }
        remove_pidfile();
    }
    start()
}

/// `hive stop`: SIGTERM the collector, escalate to SIGKILL if it lingers.
pub fn stop() -> Result<()> {
    let pid = match read_pid()? {
        Some(pid) if pid_alive(pid) => pid,
        _ => {
            // Pidfile missing/stale — the daemon may still be alive (e.g. the
            // pidfile was deleted). Find it by process name instead.
            let orphans = find_daemon_pids(std::process::id())?;
            if orphans.is_empty() {
                remove_pidfile();
                return Ok(());
            }
            for pid in &orphans {
                signal(*pid, libc::SIGTERM).ok();
            }
            let deadline = Instant::now() + Duration::from_secs(10);
            loop {
                let alive: Vec<u32> = orphans
                    .iter()
                    .copied()
                    .filter(|pid| pid_alive(*pid))
                    .collect();
                if alive.is_empty() {
                    break;
                }
                if Instant::now() >= deadline {
                    for pid in &alive {
                        signal(*pid, libc::SIGKILL).ok();
                    }
                    break;
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            remove_pidfile();
            let mut status = read_status();
            status.running = false;
            status.connected = false;
            write_status(&status)?;
            return Ok(());
        }
    };

    signal(pid, libc::SIGTERM).ok();

    let deadline = Instant::now() + Duration::from_secs(10);
    while Instant::now() < deadline {
        if !pid_alive(pid) {
            remove_pidfile();
            let mut status = read_status();
            status.running = false;
            status.connected = false;
            write_status(&status)?;
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(100));
    }

    signal(pid, libc::SIGKILL).ok();
    remove_pidfile();
    bail!("collector did not exit after SIGTERM; sent SIGKILL")
}

pub fn current_status() -> Status {
    let mut status = read_status();
    match read_pid() {
        Ok(Some(pid)) if pid_alive(pid) => status.running = true,
        _ => {
            status.running = false;
            status.connected = false;
        }
    }
    status
}

pub fn mark_stopped() {
    remove_pidfile();
    let mut status = read_status();
    status.running = false;
    status.connected = false;
    let _ = write_status(&status);
}

/// Exclusive single-instance lock held for the daemon's whole lifetime, so a
/// lost/corrupted pidfile can never lead to two collectors running at once.
pub fn acquire_instance_lock() -> Result<fs::File> {
    use std::os::unix::io::AsRawFd;
    ensure_state_dir()?;
    let path = state_dir().join("collector.lock");
    let file = fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(&path)
        .with_context(|| format!("failed to open {}", path.display()))?;
    let acquired = unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) };
    if acquired != 0 {
        bail!(
            "another collector instance is already running (lock: {})",
            path.display()
        );
    }
    Ok(file)
}

/// Find detached collector processes (`<…>/hive run` / `<…>/collector run`)
/// without relying on the pidfile — used by `hive stop` when the pidfile is
/// missing or stale.
fn find_daemon_pids(exclude: u32) -> Result<Vec<u32>> {
    let output = Command::new("pgrep")
        .args(["-f", r#"(^|/)(hive|collector) run"#])
        .output()
        .context("failed to run pgrep")?;
    let text = String::from_utf8_lossy(&output.stdout);
    Ok(text
        .lines()
        .filter_map(|line| line.trim().parse::<u32>().ok())
        .filter(|pid| *pid != exclude)
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::set_state_dir_for_tests;
    use std::sync::{Mutex, OnceLock};

    /// The state dir is process-global, so pidfile tests must not run in
    /// parallel with each other.
    fn state_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    /// Redirect the state dir to a throwaway location and lock it for the
    /// whole test. Without this, these tests would create/remove the REAL
    /// `~/.local/state/hive/collector.pid` and confuse a live daemon.
    fn isolate_state_dir() -> std::sync::MutexGuard<'static, ()> {
        let guard = state_lock().lock().unwrap();
        let dir = std::env::temp_dir().join(format!("hive-test-state-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        set_state_dir_for_tests(&dir);
        remove_pidfile();
        guard
    }

    #[test]
    fn pidfile_write_read_remove() {
        let _guard = isolate_state_dir();
        write_pidfile(12345).unwrap();
        assert_eq!(read_pid().unwrap(), Some(12345));
        remove_pidfile();
        assert_eq!(read_pid().unwrap(), None);
    }

    #[test]
    fn pid_alive_checks_current_process() {
        let _guard = isolate_state_dir();
        assert!(pid_alive(std::process::id()));
        let mut child = Command::new("true").spawn().unwrap();
        let pid = child.id();
        child.wait().unwrap();
        assert!(!pid_alive(pid));
    }
}
