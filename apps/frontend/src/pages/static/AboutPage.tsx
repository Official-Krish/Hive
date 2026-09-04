import { StaticPage } from "@/components/layout/StaticPage";

export function AboutPage() {
  return (
    <StaticPage
      eyebrow="Company · About"
      title="Where your team and AI agents build together"
      description="Hive turns raw AI-coding activity into a living picture of what your team is building — developers, agents, and everything they ship, in one shared workspace."
    >
      <h2 id="what">What Hive is</h2>
      <p>
        Software teams now ship with AI agents sitting next to humans — Claude,
        Codex, and friends writing code, opening PRs, running tests. But
        managers and teammates can't see any of it. Hive is the missing
        instrument panel: a lightweight local collector observes agent and
        engineering activity, and the dashboard turns it into efficiency
        metrics, alerts, and a spatial office you can walk around.
      </p>

      <h2 id="principles">What we believe</h2>
      <ul>
        <li>
          <strong>Telemetry in, source code never leaves.</strong> Observability
          shouldn't cost you your crown jewels.
        </li>
        <li>
          <strong>Privacy is a control, not a promise.</strong> Server-side
          gates, per workspace, on by default where it matters.
        </li>
        <li>
          <strong>Ambient over interrogative.</strong> Nobody should need a
          status meeting to know what's shipping.
        </li>
        <li>
          <strong>Boring infrastructure.</strong> Postgres, Redis, idempotent
          ingest — the unglamorous stack that doesn't page you.
        </li>
      </ul>

      <h2 id="open">Open source</h2>
      <p>
        Hive is MIT-licensed. The platform, event contracts, and local collector
        live in the open — audit them, self-host them, contribute back. Find us
        on <a href="https://github.com">GitHub</a>.
      </p>
    </StaticPage>
  );
}

export default AboutPage;
