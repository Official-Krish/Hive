# @hive/types

Shared **zod validation schemas and TypeScript types** for the Hive platform.
Single source of truth for every request body, query string, and API response
shape so the backend never redefines contracts.

---

## Modules

| Module      | Contents                                                                     |
| ----------- | ---------------------------------------------------------------------------- |
| `auth`      | Register/login input, session result, `/me` user                             |
| `api`       | `Paginated<T>`, `paginationSchema`                                           |
| `devices`   | Device registration + API key types                                          |
| `workspace` | Workspace CRUD, member roles, invites                                        |
| `reads`     | Activity/session/PR/alert/task/test-run/metric filters + summaries & details |
| `privacy`   | `PrivacySetting` schema, update schema, defaults                             |
| `org`       | Org summary, members, plan + update schemas                                  |
| `realtime`  | Realtime client messages, snapshot/member payloads                           |

---

## Usage

```ts
import { createWorkspaceInputSchema, type WorkspaceSummary } from "@hive/types";

// validation middleware in the backend:
validateBody(createWorkspaceInputSchema);
```

Conventions:

- Request bodies are validated with zod; inferred types are exported as
  `z.infer<...>` (e.g. `CreateWorkspaceInput`).
- API-facing enum values are lowercase strings; the backend maps to/from the
  UPPER_SNAKE database enums at the module boundary.
- Types are `interface`/`type` exports for responses; filters extend
  `paginationSchema` for consistent `page`/`pageSize` handling.

---

## Scripts

```sh
bun run lint         # ESLint
bun run check-types  # tsc --noEmit
```

No runtime scripts — this package is consumed as a workspace dependency by
`@hive/backend` and others.
