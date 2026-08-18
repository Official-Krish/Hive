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
- **GitHub integration** is a GitHub OAuth App (src/modules/github/) — user "Connect with GitHub" flow + per-repo webhooks.
  - OAuth: `GET /api/github/auth/login` (302 to GitHub with a signed `state` JWT) → `GET /api/github/auth/callback` (verify state, exchange code, fetch `/user` + `/user/emails`, link by session/email or provision a new user with `AuthService.provisionUser`). Callback sets the same dual auth cookies and 302s back to the frontend. `POST /api/github/disconnect` (requireAuth).
  - Tokens are stored **encrypted at rest** via `lib/encryption.ts` (AES-256-GCM, key from `GITHUB_TOKEN_ENCRYPTION_KEY`). OAuth App tokens don't expire, so there is no refresh logic.
  - Webhooks: `POST /api/github/webhooks` is mounted with `express.raw` BEFORE `csrfProtect` and `express.json` (raw body needed for HMAC `X-Hub-Signature-256` verification; GitHub sends no allowed Origin). Handles `push` (→ `Repository`/`Branch`/`Commit` upserts), `pull_request` (→ `PullRequest` upsert), `ping`; unknown events are acked. Every hit is recorded in `WebhookDelivery`.
  - New repos auto-link to the owning account user's primary workspace (`workspaceId` = first `WorkspaceMember`), then broadcast `repo.push`/`pr.updated` realtime events.
  - GitHub account/repo ids are stored as Int (`githubId`, `githubRepoId`) — must fit Postgres int4.

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
