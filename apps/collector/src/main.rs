use clap::{Parser, Subcommand};
use collector::config::Config;
use collector::daemon;
use collector::modules::terminal;

#[derive(Parser)]
#[command(
    name = "hive",
    about = "Hive collector — lightweight background agent streaming telemetry to Hive"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Log in with GitHub (device flow) and store a session for registration.
    Login,
    /// Forget the stored session.
    Logout,
    /// Register a device and pick a workspace (auto-run by `start` if needed).
    Install,
    /// Run the collector in the foreground.
    Run,
    /// Start the collector as a background daemon.
    Start,
    /// Stop the background daemon (graceful shutdown).
    Stop,
    /// Show whether the daemon is running, connected, and how much is queued.
    Status,
    /// Manage local configuration.
    Config {
        #[command(subcommand)]
        action: ConfigAction,
    },
    /// Install the terminal preexec hook (zsh/bash) so commands are captured.
    InstallHook,
    /// Remove the terminal preexec hook.
    UninstallHook,
}

#[derive(Subcommand)]
enum ConfigAction {
    /// Write a default config to ~/.config/hive/config.toml.
    Init,
    /// Set a config key, e.g. `hive config set device_token hive_dev_…`.
    Set { key: String, value: String },
    /// Print the current config (token masked).
    Show,
    /// Add a directory to watch.
    AddWatch { path: String },
}

fn init_logging() {
    let filter = std::env::var("RUST_LOG")
        .unwrap_or_else(|_| "info".to_string());
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::builder()
                .parse_lossy(&filter),
        )
        .init();
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    if let Err(err) = run_cli(cli).await {
        eprintln!("error: {err:#}");
        std::process::exit(1);
    }
}

async fn run_cli(cli: Cli) -> anyhow::Result<()> {
    match cli.command {
        Command::Login => {
            init_logging();
            collector::session::login().await.map(|_| ())
        }
        Command::Logout => {
            collector::session::logout();
            Ok(())
        }
        Command::Install => {
            init_logging();
            collector::install::run().await
        }
        Command::Run => {
            init_logging();
            collector::runner::run().await
        }
        Command::Start => {
            init_logging();
            if !collector::config::Config::load()?.is_configured() {
                println!("→ not registered yet; registering this machine…");
                collector::install::run().await?;
            }
            if !collector::config::Config::load()?.is_configured() {
                // install printed guidance (e.g. "create or join a workspace
                // from the web") but did not register; nothing to start.
                return Ok(());
            }
            daemon::start().map(|pid| println!("collector started (pid {pid})"))
        }
        Command::Stop => daemon::stop().map(|()| println!("collector stopped")),
        Command::Status => {
            let status = daemon::current_status();
            println!("running: {}", status.running);
            println!("connected: {}", status.connected);
            println!("queued: {}", status.queued);
            if let Some(pid) = status.pid {
                println!("pid: {pid}");
            }
            if let Some(seen) = &status.last_seen_at {
                println!("last seen: {seen}");
            }
            if let Some(err) = &status.error {
                println!("error: {err}");
            }
            Ok(())
        }
        Command::Config { action } => match action {
            ConfigAction::Init => {
                let path = collector::config::config_path();
                if path.exists() {
                    println!("config already exists at {}", path.display());
                } else {
                    let config = Config::default();
                    config.save()?;
                    println!("wrote default config to {}", path.display());
                }
                Ok(())
            }
            ConfigAction::Set { key, value } => {
                let mut config = Config::load()?;
                config.set(&key, &value)?;
                config.save()?;
                println!("set {key}");
                Ok(())
            }
            ConfigAction::Show => {
                let config = Config::load()?;
                let mut shown = config.clone();
                if !shown.device_token.is_empty() {
                    shown.device_token = "****".to_string();
                }
                println!(
                    "{}",
                    toml::to_string_pretty(&shown).unwrap_or_else(|_| "unparseable".into())
                );
                Ok(())
            }
            ConfigAction::AddWatch { path } => {
                let mut config = Config::load()?;
                config.add_watch(&path)?;
                config.save()?;
                println!("watching {path}");
                Ok(())
            }
        },
        Command::InstallHook => terminal::install_hook(),
        Command::UninstallHook => terminal::uninstall_hook(),
    }
}