---
description: Hive backend conventions - Express, Bun, Prisma, dual-token auth.
globs: "*.ts, *.tsx, *.js, *.jsx, package.json"
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## Stack

- **Express 5** (`express`), run with Bun, for the HTTP API. Do NOT use `Bun.serve()` for the API server.
- **Prisma 7** via `@hive/db` (packages/db). Use the shared singleton: `import { prisma } from "@hive/db"`.
- **Shared zod schemas / types** live in `@hive/types` (packages/types). Import them, never redefine.
- **Real-time is Bun native WebSockets** on a separate port (`WS_PORT`), served by `Bun.serve` via the `RealtimeHub` class (src/modules/realtime/realtime.hub.ts). No SSE, no `ws` package.
  - Postgres is the source of truth: write to the DB first, then broadcast a `RealtimeEvent` to the workspace topic.
  - Rooms = Bun pub/sub topics (`realtimeChannel(workspaceId)` = `realtime:workspace:{id}`). Join = `ws.subscribe(topic)`, fan-out = `server.publish(topic, payload)` (includes the sender).
  - Upgrade auth: `access_token` cookie (same JWT as HTTP) + `?workspaceId=` + `WorkspaceMember` check. Attach `{ userId, deviceId, workspaceId }` to `ws.data`.
  - Client→server messages validated with `realtimeClientMessageSchema` (`avatar.move`, `presence.update`).
  - `realtimeBus` (src/modules/realtime/realtime.bus.ts) is the process-wide publisher registry: the hub registers on start, so non-WS code (e.g. GitHub webhooks) can broadcast `RealtimeEvent`s without a hub reference.
  - **Device control path** `/ws/device?token=…` (collector↔backend) is a second, separate socket type handled by the same hub — see "Devices + Ingest".
- **GitHub integration** is a GitHub OAuth App (src/modules/github/) — user "Connect with GitHub" flow + per-repo webhooks.
  - OAuth: `GET /api/github/auth/login` (302 to GitHub with a signed `state` JWT) → `GET /api/github/auth/callback` (verify state, exchange code, fetch `/user` + `/user/emails`, link by session/email or provision a new user with `AuthService.provisionUser`). Callback sets the same dual auth cookies and 302s back to the frontend. `POST /api/github/disconnect` (requireAuth).
  - Tokens are stored **encrypted at rest** via `lib/encryption.ts` (AES-256-GCM, key from `GITHUB_TOKEN_ENCRYPTION_KEY`). OAuth App tokens don't expire, so there is no refresh logic.
  - Webhooks: `POST /api/github/webhooks` is mounted with `express.raw` BEFORE `csrfProtect` and `express.json` (raw body needed for HMAC `X-Hub-Signature-256` verification; GitHub sends no allowed Origin). Handles `push` (→ `Repository`/`Branch`/`Commit` upserts), `pull_request` (→ `PullRequest` upsert), `ping`; unknown events are acked. Every hit is recorded in `WebhookDelivery`.
  - New repos auto-link to the owning account user's primary workspace (`workspaceId` = first `WorkspaceMember`), then broadcast `repo.push`/`pr.updated` realtime events.
  - GitHub account/repo ids are stored as Int (`githubId`, `githubRepoId`) — must fit Postgres int4.

## Devices + Ingest (collector telemetry)

- **Devices** (src/modules/devices/) let the local collector authenticate as a user's machine. `POST /api/devices` creates a `Device` + an `ApiKey` (`scopes: ["collect"]`, `keyHash` = sha256, prefix `hive_dev_`); the plaintext token is shown once. `requireDevice` middleware reads `X-Device-Token`, resolves the key, and sets `res.locals.device = { userId, deviceId, keyId }` (`getDevice(res)` to read it). Revoke = mark the ApiKey REVOKED.
- **Presence**: `DeviceSummary.online` = the collector's control socket is live **OR** `lastSeenAt` is within `ONLINE_WINDOW_MS` (5 min). Registering a device and each control-socket open/heartbeat calls `DeviceService.markSeen` (best-effort). `DeviceService.hasOnlineDevice(userId)` drives the invite gate.
- **Control channel** (src/modules/realtime/realtime.hub.ts): the collector holds a persistent Bun-native WS at `{ws_url}/ws/device?token=…` (X-Device-Token passed as a query param). Upgrade validates the token against `ApiKey` (`scopes: ["collect"]`) and attaches `{ userId, deviceId, keyId }` to `ws.data`. It uses a **separate device topic** (`realtime:device:{deviceId}`, not the workspace topic) and does NOT subscribe to `realtime:workspace:*`. Server→device messages match `deviceControlSchema` (`{ type:"control", cmd:"shutdown"|"reconnect"|"ping", timestamp }`); device→server matches `deviceMessageSchema` (`{ type:"heartbeat", timestamp }`), which refreshes `lastSeenAt`. `isDeviceData` guards the device socket from normal realtime client messages.
- **`deviceBus`** (src/modules/realtime/realtime.bus.ts) is the device counterpart of `realtimeBus`: the hub registers `setSender`/`setOnlineChecker` on start so non-WS code (e.g. the devices module) can `send(deviceId, ...)` and `isOnline(deviceId)` without a hub reference.
- **Remote shutdown**: `POST /api/devices/:id/stop` (owner only) checks `isOnline`, else throws `DeviceOfflineError` (409). It calls `deviceBus.send(deviceId, { type:"control", cmd:"shutdown" })` and returns `{ data: { stopped: true } }`. The collector flushes its outbox, disconnects, and exits; lastSeenAt then ages out and `online` flips false.
- **Invite gate**: `acceptInvite` verifies email/revoked/expired first (403), then requires `devices.hasOnlineDevice(acceptingUser.id)` — a 409 `DeviceRequiredError` (`DEVICE_REQUIRED`) means "connect a collector first". Registering a device does NOT satisfy the gate; the control socket must actually be open (or lastSeen within 5 min).
- **Ingest** (src/modules/ingest/, `POST /api/ingest/events`) accepts an `ingestBatchSchema` batch from `@hive/events`. Per-batch checks: device belongs to the user AND the user is a `WorkspaceMember` of `batch.workspaceId` (else 403). Event→DB mapping is idempotent: client-generated `sessionId`/`activityId`/`testRunId` become DB row ids via upsert-on-id, repos upsert on `(workspaceId, name)`, commits on `(repositoryId, sha)`, PRs on `(repositoryId, number)`. Token costs are derived from `Model` pricing. `process.*`/`terminal.command`/`file.modified` attach as `AgentEvent`/`ActivityEvent` rows (payload + sequence) to the developer's most recent RUNNING session or IN_PROGRESS activity. Live updates broadcast via `realtimeBus` (`agent.started/stopped`, `activity.updated`, `repo.push`, `pr.updated`). A failed event increments `failures` but never drops the rest of the batch.

## Workspaces (org + team management)

- **Middleware** (src/middleware/workspace.ts): `requireWorkspaceMember()` resolves the caller's membership for `:workspaceId` into `res.locals.membership` (`{ workspaceId, userId, role }`). `requireWorkspaceRole("admin", "owner")` gates routes on the role. Run after `requireAuth()`.
- **Routes** (src/modules/workspaces/): `workspacesRouter` at `/api/workspaces`, `invitesRouter` at `/api/invites`. CRUD + members + invites; DELETE is owner-only, PATCH/invite/revoke are admin+.
- Registration auto-provisions a personal org + "Main" workspace, so a fresh user already has one. `WorkspaceService.primaryOrgId` reuses the first `OrganizationMember` (or creates an org if none exists).
- Invites: raw token is hashed (`hashToken`) into `Invite.tokenHash` and shown once in the create response. `POST /api/invites/:token/accept` requires the accepting user's email to match `Invite.email` (403 otherwise), upserts `OrganizationMember` + `WorkspaceMember`, and sets `acceptedAt` in a transaction. Status is derived: revoked → accepted → expired → pending.
- Slug uniqueness is per-org (`@@unique([orgId, slug])`); a conflicting slug gets a random hex suffix.

## Reads (query API layer)

- **Routes** (src/modules/reads/) mounted at `/api/workspaces` (after the workspaces router) + `/api/models`. Every read route is `requireAuth()` + `requireWorkspaceMember()`; the one write — `POST /:workspaceId/alerts/:alertId/resolve` — is admin+.
- Query filters are zod schemas in `@hive/types` (`activityFilterSchema`, `sessionFilterSchema`, `prFilterSchema`, `alertFilterSchema`, `taskFilterSchema`, `testRunFilterSchema`, `metricFilterSchema`) extended from `paginationSchema`; validated via `validateQuery` → `req.parsedQuery`.
- `GET /map` uses `RealtimeService.getSnapshot` (map is upserted if missing). List responses are `Paginated<T>` (`{ items, page, pageSize, total, hasMore }`).
- Scope rules: activities/sessions/repos/PRs/tasks/alerts filter directly on `workspaceId`; **test runs** scope via `OR: [{ repository: { workspaceId } }, { activity: { workspaceId } }]` because `TestRun` has no `workspaceId` column (must be linked to an activity/repo to be readable).
- Git events (`git.commit`, `git.pull_request`) are NOT linked to activities (no `activityId` in the schema), so `activity.commits/pullRequests` only populate via the GitHub webhook path. Cost rollups derive from `Model` pricing (`costCents` = USD cents).
- Models live at `/api/models` (not `/api/workspaces/models`) because the workspaces router's `/:workspaceId` would swallow it.

## Privacy

- **Routes** (src/modules/privacy/) mounted at `/api/workspaces`: `GET /:workspaceId/privacy` (any member), `PATCH /:workspaceId/privacy` (admin+). Body is `updatePrivacySettingSchema` (partial). Patch records `updatedById`; GET returns schema defaults + `updatedAt: null` only when no row exists.
- **Rows are created at workspace creation** (auth registration and `WorkspaceService.create`), so a fresh workspace already has a PrivacySetting with defaults. Defaults: summaries/agent-status/token-usage/git-metadata allowed; **file paths, exact commands, prompt metadata hidden by default**.
- **Gating** (src/modules/privacy/privacy-gate.ts) is pure and nulls/empties fields so response shape stays stable: `allowTokenUsage=false` → tokens 0 / `costCents` null / `tokenUsage` `[]` / metric token+cost null; `allowActivitySummaries=false` → summaries null; `allowAgentStatus=false` → statuses null (incl. map presence); `allowGitMetadata=false` → empty commits/pullRequests + empty PR list; paths/commands/titles masked inside event payloads.
- ReadsService fetches the setting per call via `privacyOf(workspaceId)` (falls back to defaults). Filters still run on the DB; gating only affects output shaping.

## Orgs

- **Middleware** (src/middleware/org.ts): `requireOrgMember()` resolves `:orgId` membership into `res.locals.orgMembership`; `requireOrgRole(...)`/`getOrgMembership(res)` mirror the workspace equivalents. **Apply per-route, NOT via `router.use()`** — `use()`-registered middleware has no `req.params`, so the orgId lookup silently fails.
- **Routes** (src/modules/orgs/) at `/api/orgs`: GET `/:orgId` (member), PATCH `/:orgId` (admin+; plan change owner-only), GET members/workspaces (member), PATCH `/:orgId/members/:userId/role` (owner), DELETE `/:orgId/members/:userId` (owner).
- Owner protections: cannot change your own role, cannot remove yourself, cannot change/remove the org owner. A user invited via a workspace invite is upserted as an `OrganizationMember` with the same role, so every user typically has 2 org memberships (their personal org + invited orgs) — pick memberships by `orgId_userId`, never `findFirst` on userId.
- Workspace listing returns each workspace with the caller's workspace role (defaults to `member`).

## Testing

Use `bun test`. Tests run against the dev PostgreSQL database with a cookie jar to exercise the auth flows.

```ts#auth.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Auth conventions

- Dual-token: short-lived JWT access token (`access_token` cookie) + opaque hashed refresh token (`refresh_token` cookie).
- Both cookies are `httpOnly`, `Secure` in production, `SameSite=Lax`. Refresh cookie path is `/api/auth`.
- Refresh tokens rotate on every use; reuse of a rotated token revokes the whole family.
- Passwords hashed with argon2id (`Bun.password`).
- CSRF: `csrfProtect` middleware rejects cross-origin state-changing requests.
- Idempotency: `Idempotency-Key` header middleware (`idempotency()`), persisted in the `IdempotencyKey` table.

## Conventions

- Keep env config in `src/config/env.ts` (zod-validated). Never read `process.env` directly elsewhere.
- Errors: throw `AppError` subclasses from `src/core/errors.ts`. A central `errorHandler` maps them to JSON.
- Controllers are thin classes; logic lives in service classes.
- Realtime: logic lives in `realtime.service.ts` (DB), `RealtimeHub` (socket lifecycle + fan-out). Keep HTTP and WS concerns separate.
- No comments unless they explain non-obvious security/correctness decisions.

## Structure

```
src/
├── app.ts                # createApp() factory (middleware + routers)
├── index.ts              # bootstrap (env -> prisma -> listen)
├── config/env.ts         # zod-validated env
├── core/                 # errors, context types
├── lib/                  # jwt, crypto, cookies, csrf, slug, logger
├── middleware/           # validate, authenticate, csrfProtect, idempotency, errorHandler, ...
└── modules/              # feature modules (auth, users, health)
```
