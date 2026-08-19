# @hive/collector

A lightweight **Rust background agent** that runs on a developer's machine and
streams normalized telemetry to the Hive backend. It is intentionally small:
no GUI, no database beyond a tiny SQLite outbox, ~1 binary, one loopback
socket.

```
┌─────────────────┐   HTTP batches (X-Device-Token + Idempotency-Key)
│   Observation   │ ────────────────────────────►  POST /api/ingest/events
│     sources     │
│                 │   WS control channel (/ws/device)
│  process git    │ ───► online / heartbeats ──►   RealtimeHub
│  filesystem     │ ◄─── control.shutdown ──────   (backend → frontend Stop)
│  terminal       │
│  agents         │
└─────────────────┘
      ▲
  hive start / hive stop / hive status
```

## What it collects

| Source      | Event types                           | Mechanism                                                                         |
| ----------- | ------------------------------------- | --------------------------------------------------------------------------------- |
| Git         | `git.commit`, `git.branch`            | Polls watched repos with `git2`; emits commits since last-seen HEAD               |
| Filesystem  | `file.modified`                       | `notify` watcher on watched dirs (ignores `.git`, `node_modules`, `target`, …)    |
| Terminal    | `terminal.command`, `process.started` | Optional zsh/bash `preexec` hook posts to a loopback listener (`127.0.0.1:19387`) |
| Processes   | `process.stopped`                     | Tracks PIDs from terminal/agent events, emits `stopped` when they exit            |
| Claude Code | `agent.*`                             | Tails `~/.claude/projects/*/*.jsonl` (started/summary/token usage)                |
| Codex       | `agent.*`                             | Tails `~/.codex/sessions/*.jsonl`                                                 |
| OpenCode    | `agent.*`                             | Reads `message.json` parts under `~/.local/share/opencode/project/*/storage/*/`   |

Events are emitted in the exact wire format of `@hive/events`
(`packages/events/src/ingest.ts`): snake_case `type` tag + camelCase fields.
Parsers are tolerant — malformed lines are skipped and never crash the agent.

## Setup

```sh
cd apps/collector
cargo build --release          # produces target/release/collector
ln -s "$PWD/target/release/collector" ~/.local/bin/hive   # optional
```

### 1. Register a device (web)

1. In the Hive dashboard, create a device (a `hive_dev_…` token is shown once).
2. Copy the **workspace id** for the workspace you will join.

### 2. Configure the collector

```sh
hive config init
hive config set api_url http://localhost:4000      # default
hive config set ws_url ws://localhost:4001         # default
hive config set device_id <device id>
hive config set device_token <hive_dev_… token>
hive config set workspace_id <workspace id>
hive config add-watch ~/code/my-project
hive config show        # token is masked
```

### 3. Run it

```sh
hive start      # background daemon (writes ~/.local/state/hive/collector.pid)
hive status     # running? connected? queued batches?
hive stop       # graceful shutdown (SIGTERM)
hive run        # foreground (useful for debugging: RUST_LOG=debug)
```

### 4. Capture terminal commands (optional)

```sh
hive install-hook      # appends a preexec hook to ~/.zshrc / ~/.bashrc
# open a new terminal (or `source ~/.zshrc`) and type away
hive uninstall-hook
```

## Control plane & presence

While running, the collector keeps a persistent WebSocket open to
`{ws_url}/ws/device?token=…`. This is what makes it a _connected agent_:

- **Presence** — the device shows `online` in the API (`DeviceSummary.online`)
  while the socket is open **or** its `lastSeenAt` is within 5 minutes.
- **Heartbeats** — every 30s the collector sends `{type:"heartbeat"}` which
  refreshes `lastSeenAt` (no session cookies needed).
- **Remote shutdown** — the dashboard's Stop button calls
  `POST /api/devices/:id/stop`; the backend publishes
  `{type:"control", cmd:"shutdown"}` and the collector flushes, disconnects,
  and exits.
- **Join gating** — `POST /api/invites/:token/accept` returns
  `409 DEVICE_REQUIRED` unless the user has an online device. Connect the
  collector first, then join the workspace.

## Resilience

- Events are batched (≤ 200 or every 5s) and posted with a per-batch
  `Idempotency-Key`, so retries never create duplicate side effects.
- On network failure / 5xx the batch is persisted to the SQLite outbox
  (`~/.local/state/hive/outbox.db`) and drained with backoff when
  connectivity returns.
- A rejected token stops the agent and is surfaced in `hive status`.

## Configuration

`~/.config/hive/config.toml`

| Key                    | Default                 | Meaning                          |
| ---------------------- | ----------------------- | -------------------------------- |
| `api_url`              | `http://localhost:4000` | Backend HTTP base                |
| `ws_url`               | `ws://localhost:4001`   | Backend realtime base            |
| `device_id`            | —                       | Registered device id             |
| `device_token`         | —                       | `hive_dev_…` device token        |
| `workspace_id`         | —                       | Workspace to attribute ingest to |
| `poll_interval_ms`     | `2000`                  | Process liveness poll            |
| `git_poll_interval_ms` | `5000`                  | Git poll                         |
| `flush_interval_ms`    | `5000`                  | Event batch flush cadence        |
| `flush_max_events`     | `200`                   | Max events per batch             |
| `watch[]`              | —                       | Repo directories to observe      |

State and logs live under `~/.local/state/hive/` (`collector.pid`,
`status.json`, `collector.log`, `outbox.db`).

## Development

```sh
cargo test        # 27 unit tests: serialization, config, outbox, parsers, …
cargo build
```

## Security notes

- The terminal hook listener binds to `127.0.0.1` only and is unauthenticated
  by design — it is for local processes owned by the same user.
- The device token is the only credential and is sent over the control channel
  as a query parameter; use `wss://`/`https://` in production.
- Logs and the outbox contain command/file metadata — treat the state dir as
  sensitive (Unix perms, no world-readable dirs).

## Deferred

- Cursor session logs (proprietary format).
- `resource.usage` events (CPU/mem sampling) — requires a new schema.
- launchd/systemd service units (`hive install-service`).
