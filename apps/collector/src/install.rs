use crate::config::Config;
use anyhow::{bail, Context, Result};
use std::io::{BufRead, Write};

/// One-time interactive setup: logs in, registers a device, picks a workspace,
/// and writes `~/.config/hive/config.toml`. Afterwards `hive start` just works.
pub async fn run() -> Result<()> {
    let api_url = prompt("API URL", "http://localhost:4000");
    let api_url = api_url.trim().trim_end_matches('/').to_string();
    let email = prompt("Email", "");
    if email.trim().is_empty() {
        bail!("email is required");
    }
    let password = match rpassword::prompt_password("Password (hidden): ") {
        Ok(pw) => pw,
        Err(_) => prompt("Password", ""),
    };
    if password.is_empty() {
        bail!("password is required");
    }

    let client = reqwest::Client::new();

    let login = client
        .post(format!("{api_url}/api/auth/login"))
        .json(&serde_json::json!({ "email": email.trim(), "password": password }))
        .send()
        .await
        .context("failed to reach backend — is it running?")?;
    let status = login.status();
    let cookie = extract_access_token(login.headers().get_all("set-cookie").iter());
    if status.is_success() && cookie.is_some() {
        println!("✓ logged in");
    } else {
        let body = login.text().await.unwrap_or_default();
        bail!(
            "login failed (HTTP {status}): {}",
            pretty_error(&body)
        );
    }
    let cookie = cookie.unwrap();

    let default_ws = fetch_ws_url(&client, &api_url).await;
    let ws_url = prompt("WebSocket URL (control channel)", &default_ws);

    let device_name = hostname();
    let device = client
        .post(format!("{api_url}/api/devices"))
        .header("cookie", &cookie)
        .json(&serde_json::json!({ "name": device_name }))
        .send()
        .await
        .context("failed to register device")?;
    let status = device.status();
    let body: serde_json::Value = device.json().await.unwrap_or_default();
    let Some(device_id) = body["data"]["device"]["id"].as_str() else {
        bail!("device creation failed (HTTP {status}): {}", pretty_error(&body.to_string()));
    };
    let Some(token) = body["data"]["token"].as_str() else {
        bail!("device token missing from response");
    };
    println!("✓ registered device \"{device_name}\" ({device_id})");
    println!("  device token: {token}");

    let workspaces = client
        .get(format!("{api_url}/api/workspaces"))
        .header("cookie", &cookie)
        .send()
        .await
        .context("failed to list workspaces")?;
    let status = workspaces.status();
    let body: serde_json::Value = workspaces.json().await.unwrap_or_default();
    let Some(items) = body["data"].as_array() else {
        bail!("could not list workspaces (HTTP {status}): {}", pretty_error(&body.to_string()));
    };
    if items.is_empty() {
        bail!("your account has no workspaces — create one in the dashboard first");
    }
    let workspace_id = pick_workspace(items)?;

    let config = Config {
        api_url: api_url.clone(),
        ws_url: ws_url.trim().trim_end_matches('/').to_string(),
        device_id: device_id.to_string(),
        device_token: token.to_string(),
        workspace_id,
        ..Config::default()
    };
    config.save()?;
    println!("✓ config written to {}", crate::config::config_path().display());
    println!("\nDone. Start the collector with:");
    println!("  hive start");
    Ok(())
}

fn prompt(label: &str, default: &str) -> String {
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

/// Ask the backend for its realtime port (`GET /api/health` → `data.wsPort`)
/// and build the ws URL from the API URL's scheme+host.
async fn fetch_ws_url(client: &reqwest::Client, api_url: &str) -> String {
    let fallback = derive_ws_fallback(api_url);
    let Ok(resp) = client
        .get(format!("{api_url}/api/health"))
        .send()
        .await
    else {
        return fallback;
    };
    let Ok(body) = resp.json::<serde_json::Value>().await else {
        return fallback;
    };
    let Some(ws_port) = body["data"]["wsPort"].as_u64() else {
        return fallback;
    };
    ws_url_for(api_url, ws_port).unwrap_or(fallback)
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
    let choice = prompt("Select workspace", "1");
    let idx: usize = choice.trim().parse().unwrap_or(1);
    let Some(ws) = items.get(idx.saturating_sub(1)) else {
        bail!("invalid selection");
    };
    let id = ws["id"].as_str().context("workspace missing id")?.to_string();
    Ok(id)
}

/// Return the `access_token=...` Cookie header value from the login Set-Cookie
/// headers so it can be echoed back verbatim.
fn extract_access_token<'a>(
    headers: impl Iterator<Item = &'a reqwest::header::HeaderValue>,
) -> Option<String> {
    for value in headers {
        let raw = value.to_str().ok()?;
        let first = raw.split(';').next()?;
        if let Some((name, val)) = first.split_once('=') {
            if name.trim() == "access_token" && !val.is_empty() {
                return Some(format!("access_token={val}"));
            }
        }
    }
    None
}

fn pretty_error(body: &str) -> String {
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(body) {
        v["error"]["message"].as_str().unwrap_or(body).to_string()
    } else {
        body.to_string()
    }
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
    fn extracts_access_token_from_set_cookie() {
        let val = reqwest::header::HeaderValue::from_str(
            "access_token=abc123; Path=/; HttpOnly",
        ).unwrap();
        assert_eq!(extract_access_token(vec![&val].into_iter()).as_deref(), Some("access_token=abc123"));
    }

#[test]
    fn derives_ws_url() {
        assert_eq!(derive_ws_fallback("http://localhost:4000"), "ws://localhost:4001/");
        assert_eq!(derive_ws_fallback("https://hive.example.com"), "wss://hive.example.com/");
        assert_eq!(ws_url_for("http://localhost:3000", 4001).as_deref(), Some("ws://localhost:4001/"));
    }

    #[test]
    fn pretty_error_extracts_message() {
        let body = r#"{"error":{"code":"X","message":"nope"}}"#;
        assert_eq!(pretty_error(body), "nope");
    }
}