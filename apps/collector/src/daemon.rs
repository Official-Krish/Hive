use crate::config::{ensure_state_dir, log_path, pidfile_path};
use crate::status::{read_status, write_status, Status};
use anyhow::{bail, Context, Result};
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
        bail!("failed to signal pid {pid}: {}", std::io::Error::last_os_error());
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
        bail!(
            "collector is not configured. Run `hive install` for one-time setup first."
        );
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
    bail!("collector failed to start (pid {pid}); see {}", log_path().display());
}

/// `hive stop`: SIGTERM the collector, escalate to SIGKILL if it lingers.
pub fn stop() -> Result<()> {
    let Some(pid) = read_pid()? else {
        return Ok(());
    };
    if !pid_alive(pid) {
        remove_pidfile();
        return Ok(());
    }

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pidfile_write_read_remove() {
        write_pidfile(12345).unwrap();
        assert_eq!(read_pid().unwrap(), Some(12345));
        remove_pidfile();
        assert_eq!(read_pid().unwrap(), None);
    }

    #[test]
    fn pid_alive_checks_current_process() {
        assert!(pid_alive(std::process::id()));
        let mut child = Command::new("true").spawn().unwrap();
        let pid = child.id();
        child.wait().unwrap();
        assert!(!pid_alive(pid));
    }
}