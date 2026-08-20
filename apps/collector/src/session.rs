use crate::config::{ensure_state_dir, API_URL, GITHUB_LOGIN_BASE, GITHUB_SCOPE};
use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, Write};
use std::path::PathBuf;
use std::time::{Duration, Instant};

/// A stored authenticated session (`hive login`) so `hive start`'s first run
/// doesn't re-ask for credentials. The access token is a short-lived JWT used
/// to register a device / list workspaces; the refresh token is kept for
/// future silent re-authentication.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub email: String,
    pub access_token: String,
    #[serde(default)]
    pub refresh_token: String,
}

impl Session {
    pub fn path() -> PathBuf {
        crate::config::state_dir().join("session.json")
    }

    pub fn load() -> Option<Self> {
        let path = Self::path();
        if !path.exists() {
            return None;
        }
        fs::read_to_string(&path)
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
    }

    pub fn save(&self) -> Result<()> {
        ensure_state_dir()?;
        let json = serde_json::to_string_pretty(self).context("failed to serialize session")?;
        fs::write(Self::path(), json).context("failed to write session")?;
        Ok(())
    }

    pub fn clear() {
        let _ = fs::remove_file(Self::path());
    }
}

/// `hive login`: run the GitHub device flow in the terminal, exchange the
/// resulting GitHub user token for a Hive session, and persist it.
pub async fn login() -> Result<Session> {
    let client = reqwest::Client::new();
    let client_id = github_client_id(&client).await?;
    let device = request_device_code(&client, &client_id).await?;

    println!("\n1. Open {} in your browser", device.verification_uri);
    println!("2. Enter the code: {}", device.user_code);
    if webbrowser::open(&device.verification_uri).is_err() {
        println!("   (couldn't open a browser automatically — open the URL manually)");
    }

    let github_token = poll_for_token(&client, &client_id, &device).await?;
    let session = exchange_github_token(&client, &github_token).await?;
    session.save()?;
    println!("✓ logged in as {}", session.email);
    Ok(session)
}

/// `hive logout`: forget the stored session.
pub fn logout() {
    Session::clear();
    println!("✓ logged out");
}

/// Cookie header value carrying the session's access token, echoed back to the
/// backend the same way the browser would send `access_token=...`.
pub fn access_cookie(session: &Session) -> String {
    format!("access_token={}", session.access_token)
}

/// Ask the backend which GitHub OAuth app it uses (`GET /api/v1/health` →
/// `data.githubClientId`). Public value; the CLI is a public OAuth client.
async fn github_client_id(client: &reqwest::Client) -> Result<String> {
    let resp = client
        .get(format!("{API_URL}/api/v1/health"))
        .send()
        .await
        .with_context(|| {
            format!(
                "failed to reach backend at {API_URL} — is it running? \
                 (start it with `cd apps/backend && bun run dev`)"
            )
        })?;
    let body: serde_json::Value = resp.json().await.context("bad /api/v1/health response")?;
    body["data"]["githubClientId"]
        .as_str()
        .map(str::to_string)
        .with_context(|| "backend did not report a GitHub client id (GITHUB_CLIENT_ID missing?)")
}

struct DeviceCode {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
}

/// POST the OAuth device-code endpoint and parse the pending authorization.
async fn request_device_code(
    client: &reqwest::Client,
    client_id: &str,
) -> Result<DeviceCode> {
    let resp = client
        .post(crate::config::github_device_code_url())
        .header("accept", "application/json")
        .form(&[("client_id", client_id), ("scope", GITHUB_SCOPE)])
        .send()
        .await
        .with_context(|| format!("failed to contact {GITHUB_LOGIN_BASE}"))?;
    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        bail!(
            "GitHub device code request failed (HTTP {status}): {}",
            pretty_error(&body)
        );
    }
    let v: serde_json::Value = serde_json::from_str(&body).unwrap_or_default();
    Ok(DeviceCode {
        device_code: v["device_code"]
            .as_str()
            .context("GitHub did not return a device code")?
            .to_string(),
        user_code: v["user_code"]
            .as_str()
            .context("GitHub did not return a user code")?
            .to_string(),
        verification_uri: v["verification_uri"]
            .as_str()
            .context("GitHub did not return a verification URL")?
            .to_string(),
        expires_in: v["expires_in"].as_u64().unwrap_or(900),
        interval: v["interval"].as_u64().unwrap_or(5),
    })
}

/// One step of the device-flow poll. Pure so it can be unit-tested.
enum PollStep {
    Pending(u64),
    SlowDown(u64),
    Token(String),
    Denied,
    Expired,
}

fn parse_poll_response(body: &str) -> Result<PollStep> {
    let v: serde_json::Value = serde_json::from_str(body).unwrap_or_default();
    if let Some(token) = v["access_token"].as_str() {
        return Ok(PollStep::Token(token.to_string()));
    }
    let interval = v["interval"].as_u64().unwrap_or(0);
    match v["error"].as_str() {
        Some("authorization_pending") => Ok(PollStep::Pending(interval)),
        Some("slow_down") => Ok(PollStep::SlowDown(interval)),
        Some("access_denied") => Ok(PollStep::Denied),
        Some("expired_token") => Ok(PollStep::Expired),
        _ => bail!("unexpected GitHub response: {}", pretty_error(body)),
    }
}

/// Poll GitHub until the user authorizes the device (or the code expires).
async fn poll_for_token(
    client: &reqwest::Client,
    client_id: &str,
    device: &DeviceCode,
) -> Result<String> {
    let mut interval = device.interval.max(1);
    let deadline = Instant::now() + Duration::from_secs(device.expires_in.max(60));
    loop {
        if Instant::now() > deadline {
            bail!("the device code expired — run `hive login` again");
        }
        tokio::time::sleep(Duration::from_secs(interval)).await;

        let resp = client
            .post(crate::config::github_oauth_token_url())
            .header("accept", "application/json")
            .form(&[
                ("client_id", client_id.to_string()),
                ("device_code", device.device_code.clone()),
                (
                    "grant_type",
                    "urn:ietf:params:oauth:grant-type:device_code".to_string(),
                ),
            ])
            .send()
            .await
            .with_context(|| format!("failed to contact {GITHUB_LOGIN_BASE}"))?;
        let body = resp.text().await.unwrap_or_default();

        match parse_poll_response(&body)? {
            PollStep::Pending(i) => {
                if i > 0 {
                    interval = i;
                }
            }
            PollStep::SlowDown(i) => {
                interval = if i > 0 { i + 5 } else { interval + 5 };
            }
            PollStep::Token(token) => return Ok(token),
            PollStep::Denied => {
                bail!("authorization was denied in the browser — run `hive login` again")
            }
            PollStep::Expired => bail!("the device code expired — run `hive login` again"),
        }
    }
}

/// POST the GitHub user token to the backend and exchange it for a Hive
/// session. Tokens come back in the body because the CLI has no cookie jar.
async fn exchange_github_token(
    client: &reqwest::Client,
    github_token: &str,
) -> Result<Session> {
    let resp = client
        .post(format!("{API_URL}/api/v1/github/auth/token"))
        .json(&serde_json::json!({ "accessToken": github_token }))
        .send()
        .await
        .with_context(|| {
            format!(
                "failed to reach backend at {API_URL} — is it running? \
                 (start it with `cd apps/backend && bun run dev`)"
            )
        })?;
    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();
    let v: serde_json::Value = serde_json::from_str(&body).unwrap_or_default();
    if !status.is_success() {
        bail!("login failed (HTTP {status}): {}", pretty_error(&body));
    }
    let access_token = v["data"]["accessToken"]
        .as_str()
        .context("login response missing an access token")?
        .to_string();
    let refresh_token = v["data"]["refreshToken"].as_str().unwrap_or("").to_string();
    let email = v["data"]["user"]["email"].as_str().unwrap_or("").to_string();
    Ok(Session {
        email,
        access_token,
        refresh_token,
    })
}

pub fn prompt(label: &str, default: &str) -> String {
    let stdin = std::io::stdin();
    let mut out = std::io::stdout();
    let suffix: String = if default.is_empty() {
        ": ".to_string()
    } else {
        format!(" [{default}]: ")
    };
    let _ = write!(out, "{label}{suffix}");
    let _ = out.flush();
    let mut line = String::new();
    let _ = stdin.lock().read_line(&mut line);
    let trimmed = line.trim();
    if trimmed.is_empty() {
        default.to_string()
    } else {
        trimmed.to_string()
    }
}

pub fn pretty_error(body: &str) -> String {
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(body) {
        v["error"]["message"].as_str().unwrap_or(body).to_string()
    } else {
        body.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_poll_pending() {
        assert!(matches!(
            parse_poll_response(r#"{"error":"authorization_pending"}"#).unwrap(),
            PollStep::Pending(_)
        ));
    }

    #[test]
    fn parses_poll_slow_down() {
        assert!(matches!(
            parse_poll_response(r#"{"error":"slow_down","interval":10}"#).unwrap(),
            PollStep::SlowDown(10)
        ));
    }

    #[test]
    fn parses_poll_token() {
        assert!(matches!(
            parse_poll_response(r#"{"access_token":"gho_abc","token_type":"bearer"}"#).unwrap(),
            PollStep::Token(t) if t == "gho_abc"
        ));
    }

    #[test]
    fn parses_poll_denied_and_expired() {
        assert!(matches!(
            parse_poll_response(r#"{"error":"access_denied"}"#).unwrap(),
            PollStep::Denied
        ));
        assert!(matches!(
            parse_poll_response(r#"{"error":"expired_token"}"#).unwrap(),
            PollStep::Expired
        ));
    }

    #[test]
    fn access_cookie_prefixes_the_jwt() {
        let s = Session {
            email: "a@b.c".into(),
            access_token: "jwt".into(),
            refresh_token: "rt".into(),
        };
        assert_eq!(access_cookie(&s), "access_token=jwt");
    }
}