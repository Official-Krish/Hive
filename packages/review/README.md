# @hive/review

Pure, dependency-free helpers for the PR reviewer teammate, shared by
`@hive/backend` (webhook trigger) and `@hive/worker` (review executor).
Lives in its own package — instead of a relative `../../../backend`
import — so the worker Docker image (which only copies `apps/worker` +
`packages/db|queue|review`) bundles cleanly.

---

## API

```ts
import {
  scanSecrets,
  redactSecrets,
  renderComment,
  reviewCostCents,
  REVIEW_MARKER,
  REVIEW_SYSTEM_PROMPT,
} from "@hive/review";
```

- `scanSecrets(diff)` — deterministic secret scan over added lines
  (AWS keys, GitHub/Anthropic/OpenAI tokens, private-key blocks, password
  assignments). Returns `{ severity: "critical", file, line, ... }`
  findings with correct new-file line numbers.
- `redactSecrets(diff)` — masks matched secrets (`***REDACTED***`) before
  any diff text reaches the model.
- `renderComment(prNumber, findings, lines)` — the consolidated
  comment-only review body (severity-ordered, capped upstream).
- `reviewCostCents(inPrice, outPrice, inTokens, outTokens)` — USD-cents
  math shared with ingest; `null` when the model has no pricing.
- `REVIEW_MARKER` (`<!-- hive-review`) — stamps posted comments so the
  `issue_comment` webhook echo can correlate completion.
- `REVIEW_SYSTEM_PROMPT` — the model review contract (JSON findings only).

Run tests with `bun test` from this directory.
