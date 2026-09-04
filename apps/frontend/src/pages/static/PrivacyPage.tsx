import { StaticPage } from "@/components/layout/StaticPage";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "collect", label: "What we collect" },
  { id: "never", label: "What we never collect" },
  { id: "controls", label: "Workspace privacy controls" },
  { id: "github", label: "GitHub data" },
  { id: "cookies", label: "Cookies" },
  { id: "retention", label: "Retention & deletion" },
  { id: "contact", label: "Contact" },
];

export function PrivacyPage() {
  return (
    <StaticPage
      eyebrow="Legal · Privacy"
      title="Privacy Policy"
      description="What Hive observes, what stays on your machine, and the controls your workspace gets. Short version: telemetry in, source code never leaves."
      updated="September 2026"
      sections={SECTIONS}
    >
      <h2 id="overview">Overview</h2>
      <p>
        Hive is an engineering intelligence platform. A lightweight collector
        running on your machine observes AI-coding activity — agents, terminal,
        git, files, tests — and ships normalized telemetry events to your
        workspace. This policy explains what that telemetry contains, what it
        never contains, and how you control it.
      </p>

      <h2 id="collect">What we collect</h2>
      <p>When the collector runs, we receive:</p>
      <ul>
        <li>
          <strong>Agent activity</strong> — session starts and summaries, token
          usage counters, tool-call counts across Claude Code, Codex, OpenCode,
          and similar tools.
        </li>
        <li>
          <strong>Engineering activity</strong> — commit and branch metadata,
          file modification events, test results, process and terminal-command
          metadata.
        </li>
        <li>
          <strong>Presence</strong> — online/away state and heartbeats so the
          spatial office and invite gating work.
        </li>
        <li>
          <strong>Account data</strong> — name, email, avatar, organization and
          workspace memberships, and GitHub linkage records.
        </li>
      </ul>

      <h2 id="never">What we never collect</h2>
      <ul>
        <li>Your source code.</li>
        <li>Environment variables and secrets.</li>
        <li>
          Anything you redact with workspace privacy controls before it is
          broadcast (see below).
        </li>
      </ul>

      <h2 id="controls">Workspace privacy controls</h2>
      <p>
        Every workspace ships with server-side privacy gates. Admins can toggle,
        per workspace:
      </p>
      <ul>
        <li>Token usage and cost figures</li>
        <li>Activity summaries and agent status</li>
        <li>Git metadata (commits, pull requests)</li>
        <li>File paths</li>
        <li>Exact terminal commands</li>
        <li>Prompt metadata</li>
      </ul>
      <p>
        Gating happens server-side: hidden fields are nulled without changing
        response shape. Defaults hide file paths, exact commands, and prompt
        metadata; summaries, agent status, token usage, and git metadata are
        visible unless an admin turns them off.
      </p>

      <h2 id="github">GitHub data</h2>
      <p>
        If you connect GitHub, we store your GitHub user linkage and, for
        installed repositories, push and pull-request metadata from webhooks.
        OAuth tokens are encrypted at rest (AES-256-GCM) and never logged.
        Disconnecting removes the linkage; already-ingested webhook metadata
        follows the retention rules below.
      </p>

      <h2 id="cookies">Cookies</h2>
      <p>
        We use two strictly-necessary, <code>HttpOnly</code> cookies for
        sign-in: a short-lived access-token cookie and a rotating refresh-token
        cookie (scoped to the auth path). We run no advertising, analytics, or
        cross-site tracking cookies.
      </p>

      <h2 id="retention">Retention &amp; deletion</h2>
      <p>
        Telemetry is retained while your workspace exists. Deleting a workspace
        removes its members, settings, links, and associated telemetry. Revoking
        a device stops future collection from that machine immediately. Contact
        us to request export or deletion of your account data.
      </p>

      <h2 id="contact">Contact</h2>
      <p>
        Privacy questions:{" "}
        <a href="mailto:contact@hive.dev">contact@hive.dev</a>. Security issues:
        see our <a href="/security">security page</a>.
      </p>
    </StaticPage>
  );
}

export default PrivacyPage;
