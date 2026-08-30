# Hive

Engineering intelligence platform that turns raw AI-coding activity into a team
dashboard. A lightweight local collector observes agents (Claude Code, Codex,
Cursor, OpenCode), the terminal, git, and tests, and ships normalized telemetry
events to a cloud backend that provides dashboards, efficiency metrics, alerts,
and a spatial "AI lab" office.

> This repository contains the **cloud platform** (API, worker, dashboard), the
> **event contracts**, and the **local collector daemon** (`apps/collector`).

---

## Features

- **Telemetry ingest** — batched, idempotent event pipeline (`agent.*`,
  `activity.*`, `git.*`, `test.*`, `process.*`, `terminal.*`, `file.*`) with
  device-authenticated uploads.
- **Local collector** — a lightweight Rust background agent
  (`apps/collector`) that watches git, files, the terminal, and AI agents, and
  keeps a live control channel to the backend (`hive start` / `hive stop`, and
  remote shutdown from the dashboard).
- **Workspaces & organizations** — org/workspace hierarchy, role-based access
  (`owner` / `admin` / `member`), email-bound invites gated on a connected
  collector, and workspace maps.
- **Read API layer** — activities, agent sessions, repositories, pull requests,
  metrics, alerts, tasks, test runs, and per-developer stats with pagination and
  filters.
- **Privacy controls** — per-workspace settings that gate read responses
  server-side (token usage, summaries, git metadata, file paths, exact
  commands, prompt metadata) without changing response shape.
- **Real-time spatial office** — Bun-native WebSockets delivering map snapshots,
  avatars, and presence across a separate WS port.
- **GitHub integration** — OAuth App connect flow and per-repo webhooks
  (`push`, `pull_request`) with tokens encrypted at rest.
- **Background jobs** — a Redis-backed queue worker for metrics aggregation,
  session/activity finalization, presence sweeps, and reapers.

---

## Architecture

```
Developer machine
│
├── Claude Code / Codex / Cursor / OpenCode / IDE / terminal / git / tests
│
▼
apps/collector (Rust agent) ──batched events (X-Device-Token)──▶
│   │  ▲                                                       │
│   │  └─ control channel (/ws/device): online, heartbeats,    │
│   │     control.shutdown (from dashboard Stop button)        │
│   └── join gating: invite accept requires an online device   │
│                                                              ▼
                                     ┌─────────────────────────▼────────────┐
                                     │  apps/backend  (Express 5 + Bun)     │
                                     │  · REST API          :4000           │
                                     │  · Realtime WS       :4001           │
                                     │  · Device control    /ws/device      │
                                     │  · GitHub webhooks                   │
                                     └───────┬─────────────────┬────────────┘
                                             │                 │
                               writes        │                 │ broadcasts
                                             ▼                 ▼
                                     ┌──────────────┐   ┌──────────────┐
                                     │ PostgreSQL 17│   │ Redis 7      │
                                     │ (source of  │   │ (queue +     │
                                     │  truth)     │   │  pub/sub)    │
                                     └──────┬───────┘   └──────────────┘
                                            │
                                            ▼
                                     ┌──────────────┐
                                     │ apps/worker  │  scheduled jobs + consumer
                                     └──────────────┘
                                     ┌──────────────┐
                                     │ apps/frontend│  dashboard (Bun-served)
                                     └──────────────┘
```

All apps/packages are 100% TypeScript (except the Rust collector), run on
**Bun 1.3+**, and are managed as a **Turborepo + Bun workspaces** monorepo.

---

## Repository layout

| Path                         | Description                                                |
| ---------------------------- | ---------------------------------------------------------- |
| `apps/backend`               | REST API, realtime hub, GitHub integration, auth, ingest   |
| `apps/worker`                | Background job scheduler + queue consumer                  |
| `apps/collector`             | Local Rust collector daemon (`hive`) — not a Bun workspace |
| `apps/frontend`              | Dashboard / API tester served by Bun                       |
| `packages/db`                | Prisma 7 schema, migrations, seed, shared client singleton |
| `packages/types`             | Shared zod validation schemas + TypeScript API types       |
| `packages/events`            | Telemetry event contracts (`@hive/events`)                 |
| `packages/queue`             | Redis-backed queue + scheduler (`@hive/queue`)             |
| `packages/eslint-config`     | Shared ESLint configurations                               |
| `packages/typescript-config` | Shared `tsconfig` presets                                  |
| `packages/ui`                | Shared React components (WIP)                              |

---

## Prerequisites

- **Bun** `1.3.14` or newer (the pinned package manager — see
  `devEngines.packageManager`).
- **Rust** `1.85+` (edition 2024) for the collector (`apps/collector`).
- **Docker** with the compose plugin (Postgres 17 + Redis 7).
- Node.js `>=18` for tooling that requires it (Turborepo).

---

## Quickstart

```sh
# 1. Install dependencies (workspace-aware)
bun install

# 2. Start Postgres and Redis
docker compose up -d

# 3. Prepare the database (generate client + apply migrations + seed)
bun run db:generate
bun run db:migrate
bun run db:seed

# 4. Configure the backend
cp apps/backend/.env.example apps/backend/.env
#    ...then fill in secrets (see Environment variables)

# 5. Run the platform
bun run dev            # API (:4000), WebSocket (:4001), frontend (:5173-ish)
bun run worker:dev     # in a second terminal — queue consumer + scheduler
```

> `bun run dev` runs every workspace's `dev` script via Turborepo. The backend
> binds the REST API on `PORT` (default `4000`) and the realtime hub on
> `WS_PORT` (default `4001`); the frontend serves its own HTTP server.

### Local collector

The collector is a separate Rust crate, not a Turborepo workspace. Build and
run it with `hive`:

```sh
cd apps/collector
cargo build --release          # → target/release/collector
ln -s "$PWD/target/release/collector" ~/.local/bin/hive

hive login                    # once: GitHub device flow (opens browser, enter code)
hive start                    # registers the device on first run, then starts
hive status                   # running? connected?
hive stop
```

For distributed installs, `apps/collector/scripts/install.sh` downloads the
platform binary from a CDN and installs it as `~/.local/bin/hive`
(`curl -fsSL <CDN>/install.sh | bash`).

See [`apps/collector/README.md`](apps/collector/README.md) for full setup,
the control channel, and remote shutdown.

---

## Development commands

| Command                  | Description                                     |
| ------------------------ | ----------------------------------------------- |
| `bun install`            | Install all workspace dependencies              |
| `bun run dev`            | Run every app/package in watch mode (Turborepo) |
| `bun run build`          | Build all apps and packages                     |
| `bun run check-types`    | `tsc --noEmit` across all workspaces            |
| `bun run lint`           | ESLint across all workspaces                    |
| `bun test` (per package) | Run `bun test` inside a workspace               |
| `bun run format`         | Prettier across `ts`, `tsx`, and `md` files     |
| `docker compose up -d`   | Start Postgres + Redis                          |
| `bun run db:up`          | Start Postgres only                             |
| `bun run redis:up`       | Start Redis only                                |
| `bun run db:down`        | Stop both                                       |
| `bun run db:generate`    | Regenerate the Prisma client                    |
| `bun run db:migrate`     | Apply dev migrations                            |
| `bun run db:studio`      | Open Prisma Studio                              |
| `bun run db:seed`        | Seed reference data                             |
| `bun run worker:dev`     | Run the background worker in watch mode         |

Husky + lint-staged run ESLint and Prettier on staged files before commits.

---

## Environment variables

Backend and worker validate their environment with zod and fail fast on
misconfiguration. Every variable is documented in
[`apps/backend/.env.example`](apps/backend/.env.example).

Key variables:

| Variable                                                                                              | Used by             | Notes                                                      |
| ----------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`                                                                                        | backend, worker, db | Postgres connection string                                 |
| `PORT` / `WS_PORT`                                                                                    | backend             | REST API and realtime hub ports                            |
| `API_URL` / `WS_URL` / `CLIENT_URLS`                                                                  | backend             | CORS + cookie origins (comma-separated)                    |
| `ACCESS_TOKEN_SECRET`                                                                                 | backend             | ≥32 chars; `openssl rand -base64 48`                       |
| `REFRESH_TOKEN_TTL_DAYS`                                                                              | backend             | Refresh token lifetime (default 30)                        |
| `COOKIE_SECURE`                                                                                       | backend             | `true` in production (HTTPS)                               |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_WEBHOOK_SECRET` / `GITHUB_TOKEN_ENCRYPTION_KEY` | backend             | GitHub OAuth App + webhook HMAC + at-rest token encryption |
| `LOG_LEVEL`                                                                                           | backend, worker     | pino level; `silent` in tests                              |

Redis is configured by convention, not env vars: the client resolves host
`redis` in `production` and `localhost` otherwise (see `packages/queue`).

---

## Testing

- Backend: `bun test` in `apps/backend` (needs Postgres + Redis reachable; the
  suite boots the app against real containers and exercises auth, devices,
  ingest, workspaces/invites, reads, privacy, orgs, GitHub, realtime, and a
  boot smoke).
- Events / queue / db: `bun test` in each package.
- Shared test helpers live in `apps/backend/test/helpers.ts`
  (`startServer`, `makeClient`, cookie jar, seeders).

Run everything:

```sh
cd apps/backend && LOG_LEVEL=silent bun test
cd apps/worker  && bun test
cd packages/events && bun test
cd apps/collector && cargo test
```

---

## Production deployment notes

- **Builds**: `bun run build` emits Bun targets for backend and worker; the
  frontend bundles itself with `bun run build`.
- **Redis host**: in production the queue client connects to `redis:6379`, so
  the backend/worker must share a Docker network where the Redis service is
  named `redis`.
- **Secrets**: never commit `.env`; rotate `ACCESS_TOKEN_SECRET`,
  `GITHUB_TOKEN_ENCRYPTION_KEY`, and GitHub App secrets before shipping.
- **Migrations**: apply schema changes with `prisma migrate deploy`
  (`bun run db:deploy` inside `packages/db`) rather than `migrate dev`.
- **Graceful shutdown**: backend and worker handle `SIGINT`/`SIGTERM` and drain
  the WebSocket hub, queue, Redis, and Postgres connections.

---

## Roles & permissions

Memberships are defined by the `UserRole` enum in
`packages/db/prisma/schema.prisma`. **Organizations** and **Teams** use the
three base roles — `owner`, `admin`, `member` — while **Workspaces** use an
extended ladder:

| Role         | Rank | Capabilities                                                                  |
| ------------ | :--: | ----------------------------------------------------------------------------- |
| `owner`      |  5   | Full control, including transferring ownership and deleting the workspace.    |
| `admin`      |  4   | Day-to-day management (settings, members, invites, privacy) but no ownership. |
| `maintainer` |  3   | Manages members & repositories, installs the GitHub App, invites below them.  |
| `developer`  |  2   | Contributes and resolves alerts; read access to all workspace data.           |
| `member`     |  1   | Read access and standard participation.                                       |
| `viewer`     |  0   | Read-only observer; cannot see member list, settings, or repo config.         |

**You can only grant or manage a role strictly below your own.** An `owner` can
do everything; an `admin` cannot manage other admins or the owner; a
`maintainer` can manage up to `developer`; and so on down the ladder.

**Membership is independent per scope.** A user has a role in an _Organization_,
a role in each _Workspace_ they belong to, and a role in each _Team_. The three
are separate — an org owner is not automatically a workspace owner, and vice
versa. (Inviting a user to a workspace also upserts an `OrganizationMember` at
`owner`/`admin`/`member` — the workspace ladder never leaks into org roles.)
Any authenticated user may **create** a workspace (`POST /api/v1/workspaces`,
no membership required).

Role strings are returned lower-cased by the API
(`owner` / `admin` / `maintainer` / `developer` / `member` / `viewer`).

### Organization roles

| Action                              | owner | admin | member |
| ----------------------------------- | :---: | :---: | :----: |
| View org, list members / workspaces |  ✅   |  ✅   |   ✅   |
| Update name / slug                  |  ✅   |  ✅   |   ❌   |
| Change plan                         |  ✅   |  ❌   |   ❌   |
| Change a member's role              |  ✅   |  ❌   |   ❌   |
| Remove a member                     |  ✅   |  ❌   |   ❌   |

Self-protection: a member cannot change or remove their own role, and neither
the org owner's role nor the owner themselves can be changed or removed.

### Workspace roles

| Action                                      | owner | admin | maintainer | developer | member | viewer |
| ------------------------------------------- | :---: | :---: | :--------: | :-------: | :----: | :----: |
| Read API (activities, sessions, repos, PRs, |  ✅   |  ✅   |     ✅     |    ✅     |   ✅   |  ✅*   |
| metrics, alerts, tasks, test runs, map)     |       |       |            |           |        |        |
| View member list                            |  ✅   |  ✅   |     ✅     |    ✅     |   ✅   |   ❌   |
| View workspace settings (secret, repos,     |  ✅   |  ✅   |     ✅     |    ❌     |   ❌   |   ❌   |
| members, invites)                           |       |       |            |           |        |        |
| Update workspace (name / description)       |  ✅   |  ✅   |     ✅     |    ❌     |   ❌   |   ❌   |
| Rotate webhook secret                       |  ✅   |  ✅   |     ❌     |    ❌     |   ❌   |   ❌   |
| Link / unlink repos, install GitHub App     |  ✅   |  ✅   |     ✅     |    ❌     |   ❌   |   ❌   |
| Create / revoke invites (below own role)    |  ✅   |  ✅   |     ✅     |    ❌     |   ❌   |   ❌   |
| Change a member's role, remove a member     |  ✅   |  ✅   |     ✅     |    ❌     |   ❌   |   ❌   |
| Resolve alerts                              |  ✅   |  ✅   |     ✅     |    ✅     |   ❌   |   ❌   |
| Manage privacy settings                     |  ✅   |  ✅   |     ❌     |    ❌     |   ❌   |   ❌   |
| Transfer ownership                          |  ✅   |  ❌   |     ❌     |    ❌     |   ❌   |   ❌   |
| Delete the workspace                        |  ✅   |  ❌   |     ❌     |    ❌     |   ❌   |   ❌   |

\* `viewer` may read the public activity / map surface but not member, settings,
repo, or invite data.

Self-protection: the workspace owner's role can neither be changed nor removed;
a member can only be managed by someone strictly above them, and you cannot
remove yourself. `owner` is exclusive — transferring ownership demotes the
previous owner to `admin`.

### Team roles (org-scoped)

Teams belong to an organization, not a workspace. **Team management is gated by
the caller's _organization_ role**, and the per-team `role` field is limited to
`member` / `admin` (there is no team-level `owner`). The team `role` is currently
_informational_ — it does not grant any server-side permission; the ability to
add, re-role, or remove team members is derived from the org role below.

| Action                                       | org owner | org admin | org member |
| -------------------------------------------- | :-------: | :-------: | :--------: |
| List teams, view a team, list team members   |    ✅     |    ✅     |     ✅     |
| Create a team                                |    ✅     |    ✅     |     ❌     |
| Update / delete a team                       |    ✅     |    ✅     |     ❌     |
| Add a member (must already be an org member) |    ✅     |    ✅     |     ❌     |
| Change a team member's team-role             |    ✅     |    ❌     |     ❌     |
| Remove a team member                         |    ✅     |    ❌     |     ❌     |

Self-protection: a member cannot change or remove their own team membership.
Adding a user who is not already an organization member is rejected (HTTP 403).

---

## License

See [LICENSE](LICENSE).
