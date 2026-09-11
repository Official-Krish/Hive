import { describe, expect, test } from "bun:test";
import {
  redactSecrets,
  renderComment,
  reviewCostCents,
  scanSecrets,
} from "../index";

const diff = `diff --git a/.env b/.env
new file mode 100644
+++ b/.env
@@ -0,0 +1,3 @@
+AWS_KEY=AKIAIOSFODNN7EXAMPLE
+PASSWORD="hunter2hunter"
+OK=1
diff --git a/src/app.ts b/src/app.ts
+++ b/src/app.ts
@@ -1,2 +1,3 @@
 context
+const x = 1;
-old`;

describe("scanSecrets", () => {
  test("finds leaked secrets with file + line", () => {
    const findings = scanSecrets(diff);
    expect(findings.length).toBe(2);
    expect(findings[0]).toMatchObject({
      severity: "critical",
      file: ".env",
      line: 1,
    });
    expect(findings[1]!.file).toBe(".env");
  });

  test("ignores context and deletion lines", () => {
    expect(scanSecrets(" context\n-old\n+++ b/f\n")).toEqual([]);
  });
});

describe("redactSecrets", () => {
  test("masks secrets but keeps code", () => {
    const redacted = redactSecrets(diff);
    expect(redacted).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(redacted).not.toContain("hunter2hunter");
    expect(redacted).toContain("***REDACTED***");
    expect(redacted).toContain("const x = 1;");
  });
});

describe("renderComment", () => {
  test("renders findings and clean states", () => {
    const withFindings = renderComment(
      7,
      [
        {
          severity: "major",
          file: "src/app.ts",
          line: 2,
          title: "No test",
          detail: "Add one.",
        },
      ],
      10,
    );
    expect(withFindings).toContain("## Reviewer pass on #7");
    expect(withFindings).toContain("**major** `src/app.ts:2`");
    expect(renderComment(7, [], 3)).toContain("Clean");
  });
});

describe("reviewCostCents", () => {
  test("prices tokens and nulls on missing pricing", () => {
    expect(reviewCostCents(3, 15, 1_000_000, 1_000_000)).toBe(1800);
    expect(reviewCostCents(null, null, 10, 10)).toBeNull();
  });
});
