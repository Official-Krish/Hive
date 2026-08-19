# @repo/eslint-config

Shared ESLint configuration presets for the Hive monorepo (Turborepo
convention). Provides flattable configs used by workspaces.

## Exports

| Export                               | Purpose                          |
| ------------------------------------ | -------------------------------- |
| `@repo/eslint-config/base`           | Base TypeScript config           |
| `@repo/eslint-config/next-js`        | Next.js-specific config (legacy) |
| `@repo/eslint-config/react-internal` | React library config (legacy)    |

> Note: the backend and worker lint against the **root** `eslint.config.mts`
> (flat config with `@eslint/js`, `typescript-eslint`, and globals) rather than
> these presets. These presets exist for the Turborepo scaffold and are
> consumed by `@repo/ui` / `@repo/typescript-config` templates.

## Usage

```ts
// eslint.config.mts
import base from "@repo/eslint-config/base";

export default [
  ...base,
  {
    files: ["**/*.{ts,tsx}"],
    // workspace overrides
  },
];
```

## Development

```sh
bun install
bun run lint   # self-lint (from the package directory)
```
