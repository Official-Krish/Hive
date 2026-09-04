# syntax=docker/dockerfile:1
FROM oven/bun:1.3.14 AS builder

WORKDIR /app

# Install workspace dependencies (Bun reads the root bun.lock + workspaces in
# the root package.json). Package.json files are copied first so this layer is
# cached while only package.jsons change.
COPY package.json bun.lock ./
COPY apps/backend/package.json          apps/backend/package.json
COPY packages/db/package.json           packages/db/package.json
COPY packages/queue/package.json        packages/queue/package.json
COPY packages/types/package.json        packages/types/package.json
COPY packages/events/package.json       packages/events/package.json

RUN bun install

# Copy the source needed to bundle the backend. The @hive/* packages are
# workspace-linked into node_modules, and the Bun bundler inlines their TS.
COPY apps/backend/      apps/backend/
COPY packages/db/       packages/db/
COPY packages/queue/    packages/queue/
COPY packages/types/    packages/types/
COPY packages/events/   packages/events/

RUN cd packages/db && DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" bun --bun run prisma generate

# Bundle the backend into a single self-contained file. Using the Prisma
# driver adapter, the generated client and all @hive/* packages are inlined.
WORKDIR /app/apps/backend
ENV NODE_ENV=production
RUN bun run build

# ---- runtime ----
FROM oven/bun:1.3.14 AS runtime

WORKDIR /app
ENV NODE_ENV=production

# No node_modules required at runtime: everything is bundled into dist/index.js
# (validated — the bundle connects to Postgres + Redis on its own).
COPY --from=builder /app/apps/backend/dist ./dist

# 3000 = Express HTTP API, 4001 = realtime WebSocket hub
EXPOSE 3000 4001

CMD ["bun", "dist/index.js"]
