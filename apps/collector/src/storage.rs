use anyhow::{Context, Result};
use rusqlite::Connection;
use std::fs;
use std::sync::{Arc, Mutex};

/// SQLite-backed outbox for batches that failed to reach the backend.
/// Batches are persisted as raw JSON and drained once connectivity returns.
pub struct Outbox {
    conn: Arc<Mutex<Connection>>,
}

impl Outbox {
    pub fn open(path: &std::path::Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)
            .with_context(|| format!("failed to open outbox at {}", path.display()))?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS outbox (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0
            );",
        )?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn enqueue(&self, batch_json: String) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO outbox (batch, created_at, attempts) VALUES (?1, ?2, 0)",
            rusqlite::params![batch_json, chrono::Utc::now().timestamp_millis()],
        )?;
        Ok(())
    }

    /// Returns `(id, batch_json, attempts)` rows oldest first.
    pub fn pending(&self) -> Result<Vec<(i64, String, i64)>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt =
            conn.prepare("SELECT id, batch, attempts FROM outbox ORDER BY created_at ASC")?;
        let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row?);
        }
        Ok(out)
    }

    pub fn mark_attempt(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE outbox SET attempts = attempts + 1 WHERE id = ?1",
            rusqlite::params![id],
        )?;
        Ok(())
    }

    pub fn delete(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM outbox WHERE id = ?1", rusqlite::params![id])?;
        Ok(())
    }

    pub fn clear(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM outbox", [])?;
        Ok(())
    }

    pub fn count(&self) -> Result<usize> {
        let conn = self.conn.lock().unwrap();
        let n: i64 = conn.query_row("SELECT COUNT(*) FROM outbox", [], |row| row.get(0))?;
        Ok(n as usize)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enqueue_pending_delete() {
        let dir = tempfile::tempdir().unwrap();
        let outbox = Outbox::open(&dir.path().join("outbox.db")).unwrap();
        outbox.enqueue("{\"events\":[]}".into()).unwrap();
        outbox.enqueue("{\"events\":[1]}".into()).unwrap();
        assert_eq!(outbox.count().unwrap(), 2);

        let pending = outbox.pending().unwrap();
        assert_eq!(pending.len(), 2);
        let (id, batch, attempts) = &pending[0];
        assert_eq!(batch, "{\"events\":[]}");
        assert_eq!(*attempts, 0);

        outbox.mark_attempt(*id).unwrap();
        outbox.delete(*id).unwrap();
        assert_eq!(outbox.count().unwrap(), 1);

        outbox.clear().unwrap();
        assert_eq!(outbox.count().unwrap(), 0);
    }
}
