use crate::events::IngestBatch;
use anyhow::{bail, Context, Result};
use reqwest::StatusCode;
use std::time::Duration;

pub const IDEMPOTENCY_KEY_MIN: usize = 8;

#[derive(Debug, thiserror::Error)]
pub enum SendError {
    #[error("network or transport failure: {0}")]
    Network(String),
    #[error("server returned {0}")]
    Http(StatusCode, String),
    #[error("device token rejected: {0}")]
    Unauthorized(String),
    #[error("request rejected: {0}")]
    Rejected(String),
}

/// Thin HTTP client for `POST /api/v1/ingest/events`. The batch is sent with the
/// device token header and a per-batch `Idempotency-Key` so retries (network
/// blips, outbox replay) never duplicate side effects server-side.
pub struct IngestClient {
    http: reqwest::Client,
    api_url: String,
    device_token: String,
}

impl IngestClient {
    pub fn new(api_url: impl Into<String>, device_token: impl Into<String>) -> Result<Self> {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .context("failed to build HTTP client")?;
        Ok(Self {
            http,
            api_url: api_url.into(),
            device_token: device_token.into(),
        })
    }

    pub fn url(&self) -> &str {
        &self.api_url
    }

    pub async fn send(&self, batch: &IngestBatch, idempotency_key: &str) -> Result<(), SendError> {
        let url = format!("{}/api/v1/ingest/events", self.api_url.trim_end_matches('/'));
        let res = self
            .http
            .post(&url)
            .header("content-type", "application/json")
            .header("x-device-token", &self.device_token)
            .header("idempotency-key", idempotency_key)
            .json(batch)
            .send()
            .await
            .map_err(|err| SendError::Network(err.to_string()))?;

        match res.status() {
            StatusCode::OK | StatusCode::CREATED => Ok(()),
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
                let body = res.text().await.unwrap_or_default();
                Err(SendError::Unauthorized(body))
            }
            StatusCode::CONFLICT | StatusCode::BAD_REQUEST | StatusCode::NOT_FOUND => {
                let body = res.text().await.unwrap_or_default();
                Err(SendError::Rejected(body))
            }
            status => {
                let body = res.text().await.unwrap_or_default();
                Err(SendError::Http(status, body))
            }
        }
    }
}

pub fn new_idempotency_key() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Guards against an accidentally-empty key (the server rejects short keys).
pub fn validate_key(key: &str) -> Result<()> {
    if key.len() < IDEMPOTENCY_KEY_MIN {
        bail!("idempotency key too short");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn idempotency_keys_are_valid() {
        let key = new_idempotency_key();
        assert!(validate_key(&key).is_ok());
        assert!(validate_key("short").is_err());
    }
}