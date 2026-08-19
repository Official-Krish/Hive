# @hive/backend

The Hive cloud API — a TypeScript service built with **Express 5**, run by
**Bun**. Owns authentication, device + telemetry ingest, workspace and
organization management, the read/query API layer, privacy gating, GitHub
integration, and the realtime WebSocket hub.

| Port | Role                               |
| ---- | ---------------------------------- |
| 3000 | REST API (`PORT`)                  |
| 4001 | Realtime WebSocket hub (`WS_PORT`) |

---

## Stack

- **Express 5** + `helmet` + `cors` + `pino-http` (request logging).
- **Prisma 7** via `@hive/db` (shared singleton, `pg` adapter).
- **Zod 4** for request/query validation — schemas live in `@hive/types`.
- **Bun native WebSockets** for realtime (separate port, pub/sub topics).
- **JSON Web Tokens** for access tokens + opaque rotating refresh tokens.
- **argon2id** password hashing via `Bun.password`.

---

## Getting started

```sh
# 1. From the repo root, start infrastructure and prepare the DB (see root README)
docker compose up -d
bun run db:generate && bun run db:migrate

# 2. Create the backend env
cp .env.example .env        # fill in DATABASE_URL + secrets

# 3. Run in watch mode
bun run dev                 # or: bun --hot src/index.ts
```

The service validates its environment at boot via `src/config/env.ts` and
refuses to start on invalid configuration.

### Health check

`GET /api/health` reports `{ status, db, redis }` — useful for load balancers
and the boot smoke test.

---

## Architecture

```
src/
├── app.ts                 # createApp() factory: middleware stack + router mounts
├── index.ts               # bootstrap: connect DB/Redis, start HTTP + WS, graceful shutdown
├── config/env.ts          # zod-validated environment
├── core/errors.ts         # AppError hierarchy -> JSON error handler
├── lib/                   # jwt, crypto, cookies, csrf, slug, logger, encryption
├── middleware/
│   ├── authenticate.ts    # requireAuth (access token), session helpers
│   ├── workspace.ts       # requireWorkspaceMember / requireWorkspaceRole
│   ├── org.ts             # requireOrgMember / requireOrgRole
│   ├── validate.ts        # validateBody / validateQuery (zod)
│   ├── csrfProtect.ts     # cross-origin state-changing request guard
│   └── idempotency.ts     # Idempotency-Key middleware
└── modules/
    ├── auth/              # register/login/logout, refresh rotation, GitHub provision
    ├── devices/           # collector devices + API-key auth (X-Device-Token)
    ├── ingest/            # POST /api/ingest/events -> event-to-DB mapping + broadcasts
    ├── workspaces/        # workspace CRUD, members, invites
    ├── reads/             # query API: activities, sessions, repos, PRs, metrics, alerts, tasks
    ├── privacy/           # privacy GET/PATCH + read-gating
    ├── orgs/              # org detail/patch/members/workspaces
    ├── realtime/          # WebSocket hub + snapshot service (avatars, presence)
    ├── github/            # OAuth App connect + webhooks (push, pull_request)
    ├── users/             # /me
    └── health/            # /api/health
```

### Auth model

- **Dual-token**: short-lived JWT access token (`access_token` cookie) + opaque
  hashed refresh token (`refresh_token` cookie, path-scoped to `/api/auth`).
- Refresh tokens **rotate on every use**; reuse of a rotated token revokes the
  whole family.
- `csrfProtect` rejects cross-origin state-changing requests; GitHub webhooks
  are mounted before it (they need a raw body for HMAC verification).

### Realtime

- `RealtimeHub` (`modules/realtime/realtime.hub.ts`) runs `Bun.serve` on
  `WS_PORT`. Upgrade auth uses the access-token cookie + `?workspaceId=` +
  `WorkspaceMember` check.
- Rooms are Bun pub/sub topics: `realtime:workspace:{id}`. Postgres is the
  source of truth — write to the DB, then broadcast.
- `realtimeBus` lets non-WS code (e.g. GitHub webhooks, ingest) broadcast
  events without a hub reference.

### Ingest

`POST /api/ingest/events` accepts a batch of `@hive/events` telemetry events.
Per batch it verifies the device token and workspace membership (403
otherwise). Mapping is idempotent — collector-generated ids (`sessionId`,
`activityId`, `testRunId`) become DB row ids; repos/commits/PRs upsert on their
natural keys. Token costs derive from `Model` pricing.

### Privacy gating

Every workspace has a `PrivacySetting` row (created on workspace creation).
Reads apply gating **server-side** via `modules/privacy/privacy-gate.ts`:
masked fields are nulled/emptied so the response shape stays stable. By
default file paths, exact commands, and prompt metadata are hidden. See
`GET/PATCH /api/workspaces/:workspaceId/privacy` (patch is admin+).

---

## Testing

Requires Postgres and Redis to be reachable (see root `docker compose up -d`).

```sh
LOG_LEVEL=silent bun test
```

Suites: auth, devices, ingest, workspaces/invites, reads, privacy, orgs,
github, realtime, encryption, and a boot smoke. Shared helpers
(`test/helpers.ts`) provide `startServer`, `makeClient` (cookie jar), user
registration, workspace/invite flows, and device registration.

---

## Production

- `bun run start` (`NODE_ENV=production bun src/index.ts`).
- `bun run build` emits a Bun binary target to `dist/`.
- Set `COOKIE_SECURE=true`, generate real secrets, and place Redis behind the
  service name `redis` (see `packages/queue`).
- Apply migrations with `prisma migrate deploy`, never `migrate dev`.
