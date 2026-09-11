// Pure reviewer helpers — zero imports so both the backend trigger path
// and the worker executor can share them.

export const REVIEW_MARKER = "<!-- hive-review";

export interface ReviewFinding {
  severity: "critical" | "major" | "minor";
  file: string;
  line: number | null;
  title: string;
  detail: string;
}

const SECRET_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "GitHub token", re: /gh[pousr]_[A-Za-z0-9]{36,}/ },
  { name: "Anthropic key", re: /sk-ant-[A-Za-z0-9-_]{20,}/ },
  { name: "OpenAI key", re: /sk-[A-Za-z0-9]{20,}/ },
  {
    name: "private key block",
    re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: "password assignment",
    re: /(password|passwd|secret)\s*[:=]\s*["'][^"']{4,}["']/i,
  },
];

export const REVIEW_SYSTEM_PROMPT = `You review pull-request diffs for a small engineering team. Priorities in order: leaked secrets/credentials, injection and authz flaws, missing tests for behavior changes, then style/nits. Be terse and concrete: file, line, why it matters, suggested fix. Never invent files or lines outside the diff. Respond with JSON only: {"findings": [{"severity": "critical|major|minor", "file": "...", "line": 12, "title": "...", "detail": "..."}]}. Empty array when clean.`;

/** Deterministic secret scan — runs before any model call. */
export function scanSecrets(diff: string): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  const lines = diff.split("\n");
  let file = "";
  let line = 0;
  for (const raw of lines) {
    const header = raw.match(/^\+\+\+ b\/(.+)$/);
    if (header) {
      file = header[1]!;
      line = 0;
      continue;
    }
    if (raw.startsWith("+") && !raw.startsWith("+++")) {
      line++;
      for (const { name, re } of SECRET_PATTERNS) {
        if (re.test(raw)) {
          findings.push({
            severity: "critical",
            file,
            line,
            title: `Possible leaked ${name}`,
            detail: "Remove the secret, rotate it, and use env/secret storage.",
          });
          break;
        }
      }
    } else if (raw.startsWith(" ")) {
      // Context lines advance the new-file line number; hunk headers,
      // `diff --git` and index lines do not.
      line++;
    }
  }
  return findings;
}

/** Mask matched secrets before the diff reaches the model. */
export function redactSecrets(diff: string): string {
  let out = diff;
  for (const { re } of SECRET_PATTERNS) {
    out = out.replace(re, "***REDACTED***");
  }
  // Global flag missing on most patterns — loop line-wise for stragglers.
  return out
    .split("\n")
    .map((l) =>
      /sk-ant-|gh[pousr]_|AKIA|PRIVATE KEY/.test(l)
        ? l.replace(/[:=]\s*["']?[^"'\\s]+["']?/, ": ***REDACTED***")
        : l,
    )
    .join("\n");
}

export function renderComment(
  prNumber: number,
  findings: ReviewFinding[],
  lines: number,
): string {
  const head = `## Reviewer pass on #${prNumber}\n\nAutomated review (comment-only — a human still merges). ${lines} diff lines checked.`;
  if (findings.length === 0) {
    return `${head}\n\nClean — no findings. :white_check_mark:`;
  }
  const order = { critical: 0, major: 1, minor: 2 } as const;
  const sorted = [...findings].sort(
    (a, b) => order[a.severity] - order[b.severity],
  );
  const items = sorted
    .map(
      (f) =>
        `- **${f.severity}** \`${f.file}${f.line ? `:${f.line}` : ""}\` — ${f.title}\n  ${f.detail}`,
    )
    .join("\n");
  return `${head}\n\n${items}`;
}

export function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

export function reviewCostCents(
  inputPricePerMillion: unknown,
  outputPricePerMillion: unknown,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const inputPrice = inputPricePerMillion ? Number(inputPricePerMillion) : 0;
  const outputPrice = outputPricePerMillion ? Number(outputPricePerMillion) : 0;
  if (inputPrice === 0 && outputPrice === 0) return null;
  return Math.round(
    ((inputTokens / 1_000_000) * inputPrice +
      (outputTokens / 1_000_000) * outputPrice) *
      100,
  );
}
