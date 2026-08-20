use crate::config::{Config, API_URL};
use crate::session::{self, Session};
use anyhow::{bail, Context, Result};

/// One-time setup: logs in (reusing a `hive login` session when present),
/// registers a device, picks a workspace, and writes `~/.config/hive/config.toml`.
/// Afterwards `hive start` just works.
///
/// The API URL is hardcoded (see `config::API_URL`); the WebSocket URL is
/// discovered from the backend's `/api/v1/health` endpoint.
pub async fn run() -> Result<()> {
    let client = reqwest::Client::new();

    let mut session = match Session::load() {
        Some(session) => {
            println!("✓ using session for {}", session.email);
            session
        }
        None => session::login().await?,
    };

    // A stored token may be expired; re-login once if the backend rejects it.
    let workspaces = match list_workspaces(&client, &session).await? {
        Some(items) => items,
        None => {
            Session::clear();
            session = session::login().await?;
            match list_workspaces(&client, &session).await? {
                Some(items) => items,
                None => bail!("could not list workspaces after re-login"),
            }
        }
    };
    if workspaces.is_empty() {
        let discovery = discover(&client, API_URL).await;
        println!("No workspaces found on your account.");
        println!("Create or join a workspace from the web: {}", discovery.client_url);
        println!("Then run `hive start` again.");
        return Ok(());
    }
    let workspace_id = pick_workspace(&workspaces)?;

    let discovery = discover(&client, API_URL).await;

    let device_name = hostname();
    let device = client
        .post(format!("{API_URL}/api/v1/devices"))
        .header("cookie", session::access_cookie(&session))
        .json(&serde_json::json!({ "name": device_name }))
        .send()
        .await
        .context("failed to register device")?;
    let status = device.status();
    let body: serde_json::Value = device.json().await.unwrap_or_default();
    let Some(device_id) = body["data"]["device"]["id"].as_str() else {
        bail!("device creation failed (HTTP {status}): {}", session::pretty_error(&body.to_string()));
    };
    let Some(token) = body["data"]["token"].as_str() else {
        bail!("device token missing from response");
    };
    println!("✓ registered device \"{device_name}\" ({device_id})");
    println!("  device token: {token}");

    let config = Config {
        api_url: API_URL.into(),
        ws_url: discovery.ws_url.trim().trim_end_matches('/').to_string(),
        device_id: device_id.to_string(),
        device_token: token.to_string(),
        workspace_id,
        ..Config::default()
    };
    config.save()?;
    println!("✓ config written to {}", crate::config::config_path().display());
    Ok(())
}

/// List the user's workspaces. Returns `None` when the session is rejected
/// (401/403) so the caller can re-login.
async fn list_workspaces(
    client: &reqwest::Client,
    session: &Session,
) -> Result<Option<Vec<serde_json::Value>>> {
    let workspaces = client
        .get(format!("{API_URL}/api/v1/workspaces"))
        .header("cookie", session::access_cookie(session))
        .send()
        .await
        .context("failed to list workspaces")?;
    let status = workspaces.status();
    let body: serde_json::Value = workspaces.json().await.unwrap_or_default();
    if status.is_success() {
        return Ok(body["data"].as_array().cloned());
    }
    if status == reqwest::StatusCode::UNAUTHORIZED {
        return Ok(None);
    }
    bail!(
        "could not list workspaces (HTTP {status}): {}",
        session::pretty_error(&body.to_string())
    );
}

/// Ask the backend for its realtime port and web URL (`GET /api/v1/health` →
/// `data.wsPort` / `data.clientUrl`) and build the ws URL from the API URL's
/// scheme+host.
struct Discovery {
    ws_url: String,
    client_url: String,
}

async fn discover(client: &reqwest::Client, api_url: &str) -> Discovery {
    let mut d = Discovery {
        ws_url: derive_ws_fallback(api_url),
        client_url: api_url.to_string(),
    };
    let Ok(resp) = client
        .get(format!("{api_url}/api/v1/health"))
        .send()
        .await
    else {
        return d;
    };
    let Ok(body) = resp.json::<serde_json::Value>().await else {
        return d;
    };
    if let Some(ws_port) = body["data"]["wsPort"].as_u64() {
        if let Some(url) = ws_url_for(api_url, ws_port) {
            d.ws_url = url;
        }
    }
    if let Some(client_url) = body["data"]["clientUrl"].as_str() {
        if !client_url.is_empty() {
            d.client_url = client_url.to_string();
        }
    }
    d
}

/// `ws(s)://host:port` for an API URL, defaulting the port to 4001 when the
/// API URL uses the conventional localhost:4000 (port+1 mapping).
fn derive_ws_fallback(api_url: &str) -> String {
    let mut u = url::Url::parse(api_url)
        .unwrap_or_else(|_| url::Url::parse("ws://localhost:4001").unwrap());
    let _ = u.set_scheme(if u.scheme() == "https" { "wss" } else { "ws" });
    if u.port().unwrap_or(0) == 4000 {
        let _ = u.set_port(Some(4001));
    }
    u.to_string()
}

fn ws_url_for(api_url: &str, ws_port: u64) -> Option<String> {
    let mut u = url::Url::parse(api_url).ok()?;
    let _ = u.set_scheme(if u.scheme() == "https" { "wss" } else { "ws" });
    let _ = u.set_port(Some(u16::try_from(ws_port).ok()?));
    Some(u.to_string())
}

fn pick_workspace(items: &[serde_json::Value]) -> Result<String> {
    println!("Workspaces:");
    for (i, ws) in items.iter().enumerate() {
        let name = ws["name"].as_str().unwrap_or("?");
        let role = ws["role"].as_str().unwrap_or("member");
        println!("  {}. {} ({role})", i + 1, name);
    }
    let choice = session::prompt("Select workspace", "1");
    let idx: usize = choice.trim().parse().unwrap_or(1);
    let Some(ws) = items.get(idx.saturating_sub(1)) else {
        bail!("invalid selection");
    };
    let id = ws["id"].as_str().context("workspace missing id")?.to_string();
    Ok(id)
}

fn hostname() -> String {
    std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| "default".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derives_ws_url() {
        assert_eq!(derive_ws_fallback("http://localhost:4000"), "ws://localhost:4001/");
        assert_eq!(derive_ws_fallback("https://hive.example.com"), "wss://hive.example.com/");
        assert_eq!(ws_url_for("http://localhost:3000", 4001).as_deref(), Some("ws://localhost:4001/"));
    }
}