use crate::bus::EventSender;
use crate::config::Config;
use crate::events::{TelemetryEvent, now_rfc3339};
use git2::Repository;
use std::collections::HashMap;
use std::path::Path;
use tokio::sync::watch;

/// Polls watched git repos for new commits and branch changes, emitting
/// `git.commit` / `git.branch` events. The first poll only records the current
/// HEAD (no history dump); subsequent polls emit what appeared since.
pub struct GitWatcher {
    /// repo path -> last seen HEAD sha
    seen_head: HashMap<String, String>,
}

impl GitWatcher {
    pub fn new() -> Self {
        Self {
            seen_head: HashMap::new(),
        }
    }

    pub fn poll(&mut self, tx: &EventSender, watch_path: &str) {
        let path = Path::new(watch_path);
        let repo = match Repository::open(path) {
            Ok(repo) => repo,
            Err(_) => return,
        };

        let head = match repo.head() {
            Ok(head) => head,
            Err(_) => return,
        };
        let sha = match head.peel_to_commit() {
            Ok(commit) => commit.id().to_string(),
            Err(_) => return,
        };
        let branch = head
            .shorthand()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "HEAD".to_string());
        let repo_name = repo_name(&repo, path);

        let previous = self.seen_head.get(watch_path);
        match previous {
            None => {
                self.seen_head.insert(watch_path.to_string(), sha.clone());
                emit_branch(tx, &repo_name, &branch, Some(&sha));
            }
            Some(prev) if prev == &sha => {}
            Some(prev) => {
                emit_commits(tx, &repo, &repo_name, &branch, prev, &sha);
                self.seen_head.insert(watch_path.to_string(), sha.clone());
                emit_branch(tx, &repo_name, &branch, Some(&sha));
            }
        }
    }
}

fn emit_commits(
    tx: &EventSender,
    repo: &Repository,
    repo_name: &str,
    branch: &str,
    from_sha: &str,
    _to_sha: &str,
) {
    let mut walk = match repo.revwalk() {
        Ok(w) => w,
        Err(_) => return,
    };
    walk.push_ref(&format!("refs/heads/{branch}")).ok();
    walk.set_sorting(git2::Sort::TOPOLOGICAL).ok();

    for oid in walk {
        let oid = match oid {
            Ok(oid) => oid,
            Err(_) => continue,
        };
        if oid.to_string() == from_sha {
            break;
        }
        let Ok(commit) = repo.find_commit(oid) else {
            continue;
        };
        let authored_at = epoch_to_rfc3339(commit.time().seconds().max(0) as u64);
        let event = TelemetryEvent::GitCommit {
            timestamp: authored_at.clone(),
            repository: repo_name.to_string(),
            branch: Some(branch.to_string()),
            sha: oid.to_string(),
            message: commit.message().unwrap_or_default().to_string(),
            author_email: commit.author().email().map(|e| e.to_string()),
            authored_at: Some(authored_at),
            insertions: None,
            deletions: None,
            files_changed: None,
        };
        crate::bus::try_send(tx, event);
    }
}

fn emit_branch(tx: &EventSender, repo_name: &str, branch: &str, sha: Option<&String>) {
    let event = TelemetryEvent::GitBranch {
        timestamp: now_rfc3339(),
        repository: repo_name.to_string(),
        name: branch.to_string(),
        last_commit_sha: sha.cloned(),
    };
    crate::bus::try_send(tx, event);
}

fn repo_name(repo: &Repository, path: &Path) -> String {
    if let Ok(origin) = repo.find_remote("origin") {
        if let Some(url) = origin.url() {
            if let Some(name) = remote_slug(url) {
                return name;
            }
        }
    }
    path.file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string())
}

/// Extracts `owner/repo` from a git remote URL (https or git@ssh).
fn remote_slug(url: &str) -> Option<String> {
    let trimmed = url.trim_end_matches(".git");
    let path = if let Some(idx) = trimmed.find("://") {
        let after = &trimmed[idx + 3..];
        after.split_once('/').map(|(_, p)| p).unwrap_or(after)
    } else {
        trimmed.split(':').last().unwrap_or(trimmed)
    };
    let slug = path.trim_matches('/');
    if slug.is_empty() {
        None
    } else {
        Some(slug.to_string())
    }
}

fn epoch_to_rfc3339(secs: u64) -> String {
    let dt = chrono::DateTime::from_timestamp(secs as i64, 0);
    dt.map(|d| d.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
        .unwrap_or_else(now_rfc3339)
}

/// Background task polling all watch paths for git changes.
pub async fn spawn_tracker(
    mut watcher: GitWatcher,
    tx: EventSender,
    config: Config,
    mut shutdown: watch::Receiver<bool>,
) {
    let paths: Vec<String> = config
        .watch
        .iter()
        .filter(|w| w.enabled && !w.path.is_empty())
        .map(|w| w.path.clone())
        .collect();
    if paths.is_empty() {
        return;
    }
    let mut interval = tokio::time::interval(std::time::Duration::from_millis(
        config.git_poll_interval_ms,
    ));
    loop {
        tokio::select! {
            _ = interval.tick() => {
                for path in &paths {
                    watcher.poll(&tx, path);
                }
            }
            _ = shutdown.changed() => {
                if *shutdown.borrow() {
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
    fn parses_remote_slugs() {
        assert_eq!(
            remote_slug("https://github.com/acme/app.git"),
            Some("acme/app".into())
        );
        assert_eq!(
            remote_slug("git@github.com:acme/app.git"),
            Some("acme/app".into())
        );
        assert_eq!(remote_slug("https://example.com/repo"), Some("repo".into()));
        assert_eq!(remote_slug("https://example.com/"), None);
    }
}
