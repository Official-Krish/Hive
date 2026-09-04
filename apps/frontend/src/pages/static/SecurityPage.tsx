import { StaticPage } from "@/components/layout/StaticPage";

const SECTIONS = [
  { id: "model", label: "Security model" },
  { id: "transport", label: "Transport & storage" },
  { id: "privacy", label: "Privacy gates" },
  { id: "github", label: "GitHub" },
  { id: "collector", label: "Collector hardening" },
  { id: "report", label: "Report an issue" },
];

export function SecurityPage() {
  return (
    <StaticPage
      eyebrow="Trust · Security"
      title="Security at Hive"
      description="How telemetry moves, where secrets live, and what keeps other people's data out of your workspace."
      updated="September 2026"
      sections={SECTIONS}
    >
      <h2 id="model">Security model</h2>
      <p>
        Hive is designed so the blast radius of any single credential is small:
        device-scoped tokens for collectors, short-lived signed cookies for
        browsers, role-checked memberships for every workspace read and write.
        Raw source code is never part of the telemetry pipeline.
      </p>

      <h2 id="transport">Transport &amp; storage</h2>
      <ul>
        <li>
          <strong>TLS everywhere in production</strong> — API, WebSocket, and
          device control channels run over HTTPS/WSS. Cookies are{" "}
          <code>HttpOnly</code>, <code>Secure</code>, and{" "}
          <code>SameSite=Lax</code>.
        </li>
        <li>
          <strong>Device auth</strong> — collectors authenticate with a hashed,
          revocable device token (<code>X-Device-Token</code>). The plaintext
          token is shown once at registration.
        </li>
        <li>
          <strong>Idempotent ingest</strong> — event batches carry idempotency
          keys and upsert on client-generated IDs, so retries never duplicate
          data.
        </li>
        <li>
          <strong>CSRF + auth on every mutation</strong> — cross-origin
          state-changing requests are rejected; reads require workspace
          membership.
        </li>
      </ul>

      <h2 id="privacy">Privacy gates</h2>
      <p>
        Per-workspace privacy settings are enforced server-side before any read
        response is shaped: token usage, summaries, git metadata, file paths,
        exact commands, and prompt metadata can each be hidden without changing
        response shape. File paths, exact commands, and prompt metadata are
        hidden by default.
      </p>

      <h2 id="github">GitHub</h2>
      <ul>
        <li>
          Webhooks are verified with HMAC (<code>X-Hub-Signature-256</code>) on
          the raw body.
        </li>
        <li>OAuth tokens are encrypted at rest with AES-256-GCM.</li>
        <li>
          The CLI uses the public OAuth device flow — it links accounts but can
          never provision them; new accounts are only created via the web app.
        </li>
      </ul>

      <h2 id="collector">Collector hardening</h2>
      <ul>
        <li>
          The optional shell hook binds <code>127.0.0.1</code> only — same-user,
          same-machine by design.
        </li>
        <li>
          Telemetry batches in a local SQLite outbox with backoff, so flaky
          networks lose nothing and leak nothing extra.
        </li>
        <li>
          Remote shutdown from the dashboard flushes the outbox and exits — no
          silent background processes after you hit stop.
        </li>
      </ul>

      <h2 id="report">Report an issue</h2>
      <p>
        Found a vulnerability? Email{" "}
        <a href="mailto:contact@hive.dev">contact@hive.dev</a> with details and
        reproduction steps. We take reports seriously and will acknowledge
        within two business days. General privacy questions are covered in our{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>
    </StaticPage>
  );
}

export default SecurityPage;
