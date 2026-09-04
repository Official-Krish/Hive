# syntax=docker/dockerfile:1
FROM oven/bun:1.3.14 AS builder

WORKDIR /app

# Install workspace dependencies (Bun reads the root bun.lock + workspaces in
# the root package.json).
COPY package.json bun.lock ./
COPY apps/frontend/package.json         apps/frontend/package.json
COPY packages/types/package.json        packages/types/package.json

RUN bun install 

# Copy the frontend source plus @hive/types, which it imports directly.
COPY apps/frontend/    apps/frontend/
COPY packages/types/   packages/types/

WORKDIR /app/apps/frontend
RUN bun run build

# ---- runtime ----
FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
