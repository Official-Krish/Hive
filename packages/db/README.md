# @hive/db

Shared **Prisma 7** database package for the Hive platform. Owns the schema,
migrations, seed data, and a single Prisma client singleton wired to the
PostgreSQL driver adapter (`@prisma/adapter-pg`).

---

## What's here

```
prisma/
├── schema.prisma     # data model (users, orgs, workspaces, telemetry, ...)
├── migrations/       # committed SQL migrations
└── seed.ts           # reference seed (admin org/workspace/user)
src/generated/prisma/ # generated Prisma client (committed)
index.ts              # exported `prisma` singleton
```

### Data model highlights

- **Identity & access**: `User`, `RefreshToken`, `ApiKey`, `Organization`,
  `OrganizationMember`, `Workspace`, `WorkspaceMember`, `Invite`, `Team`.
- **Collector telemetry**: `Device`, `Activity`, `AgentSession`, `Agent`,
  `AgentEvent`, `ActivityEvent`, `TokenUsage`, `ProcessEvent`,
  `EfficiencyMetric`, `Alert`, `Task`, `TestRun`, `Repository`, `Branch`,
  `Commit`, `PullRequest`.
- **Realtime**: `WorkspaceMap`, `Avatar`, `Presence`.
- **Integrations**: `GitHubAccount`, `WebhookDelivery`, `IdempotencyKey`,
  `AuditLog`, `PrivacySetting`.

Enum values are stored as UPPER_SNAKE and surfaced through the API as
lowercase strings (`@hive/types` handles the mapping).

---

## Usage

Import the singleton — never create your own client:

```ts
import { prisma, UserRole } from "@hive/db";

const workspaces = await prisma.workspace.findMany({ where: { orgId } });
```

In non-production environments the singleton is cached on `globalThis` so
Bun's watch/hot reloads reuse one connection.

---

## Scripts

| Script        | Command                 | Purpose                                    |
| ------------- | ----------------------- | ------------------------------------------ |
| `generate`    | `prisma generate`       | Regenerate the client into `src/generated` |
| `migrate`     | `prisma migrate`        | Prisma migrate passthrough                 |
| `db:deploy`   | `prisma migrate deploy` | Apply migrations (production)              |
| `db:validate` | `prisma validate`       | Validate the schema                        |
| `db:seed`     | `prisma db seed`        | Run `prisma/seed.ts`                       |
| `studio`      | `prisma studio`         | Open the Prisma Studio UI                  |

From the repo root, run them through the root scripts (`bun run db:generate`,
`bun run db:migrate`, `bun run db:seed`, `bun run db:studio`) so the workspace
path is handled for you.

---

## Prerequisites

A reachable Postgres instance and `DATABASE_URL` in the environment:

```sh
DATABASE_URL=postgresql://postgres:mysecretpassword@localhost:5432/postgres
```

Start one locally with `docker compose up -d postgres` from the repo root.

---

## Migrations

- **Development**: edit `schema.prisma`, then `bun run db:migrate` (dev
  migrations also regenerate the client).
- **Production**: commit the generated SQL and apply with `prisma migrate
deploy` — never `migrate dev`.
