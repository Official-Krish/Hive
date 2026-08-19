# @hive/frontend

The Hive dashboard — a **React 19** single-page app served directly by **Bun**
(HTML imports, no Vite/Next build chain) with **Tailwind CSS 4** and
shadcn-style Radix UI components.

> Status: early. The app currently ships an API tester used to exercise the
> `@hive/backend` endpoints; it is the shell for the future spatial office
> dashboard.

---

## Stack

- **React 19** + `react-dom`, compiled by Bun's bundler at serve time.
- **Tailwind CSS 4** via `bun-plugin-tailwind`.
- **Radix UI** primitives (`label`, `select`, `slot`) + `class-variance-authority`,
  `clsx`, `tailwind-merge`, `tw-animate-css`.
- **lucide-react** icons.
- Dev-mode HMR and browser console relay via `Bun.serve` (`development` flag).

---

## Getting started

```sh
bun install          # workspace-aware (or from repo root)
bun run dev          # watch mode with HMR
```

The server serves `src/index.html` for all unmatched routes and proxies a
small `/api/hello` demo endpoint.

## Production

```sh
bun run build        # bundle assets (build.ts)
bun run start        # NODE_ENV=production bun src/index.ts
```

`NODE_ENV=production` disables HMR and browser console relay.

---

## Layout

```
src/
├── index.ts         # Bun.serve entrypoint
├── index.html       # app shell
├── frontend.tsx     # React mount point
├── App.tsx          # root component
├── APITester.tsx    # API tester UI
├── components/      # shared UI components
└── lib/             # utilities
```

The dashboard talks to `@hive/backend` (REST `:4000`, WebSocket `:4001`) using
the `CLIENT_URLS` origin configured on the API.
