# syntax=docker/dockerfile:1
FROM oven/bun:1.3.14 AS builder

WORKDIR /app

# Install workspace dependencies (Bun reads the root bun.lock + workspaces in
# the root package.json).
COPY package.json bun.lock ./
COPY apps/worker/package.json           apps/worker/package.json
COPY packages/db/package.json           packages/db/package.json
COPY packages/queue/package.json        packages/queue/package.json

RUN bun install

# Copy the source needed to bundle the worker. The @hive/* packages are
# workspace-linked into node_modules, and the Bun bundler inlines their TS.
COPY apps/worker/       apps/worker/
COPY packages/db/       packages/db/
COPY packages/queue/    packages/queue/

RUN cd packages/db && DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" bun --bun run prisma generate

# Bundle the worker (queue consumer + scheduler) into a single self-contained
# file.
WORKDIR /app/apps/worker
RUN bun run build

# ---- runtime ----
FROM oven/bun:1.3.14 AS runtime

WORKDIR /app
ENV NODE_ENV=production

# No node_modules required at runtime: everything is bundled into dist/index.js.
COPY --from=builder /app/apps/worker/dist ./dist

CMD ["bun", "dist/index.js"]
