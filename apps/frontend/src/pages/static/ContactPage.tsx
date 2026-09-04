import { StaticPage } from "@/components/layout/StaticPage";

export function ContactPage() {
  return (
    <StaticPage
      eyebrow="Company · Contact"
      title="Talk to us"
      description="Questions, feedback, security reports, partnership ideas — one inbox, real humans."
      cta={false}
    >
      <h2 id="email">Email</h2>
      <p>
        <a href="mailto:contact@hive.dev">contact@hive.dev</a> — we read
        everything and reply within two business days.
      </p>

      <h2 id="security">Security issues</h2>
      <p>
        Send vulnerabilities straight to{" "}
        <a href="mailto:contact@hive.dev">contact@hive.dev</a> with details and
        reproduction steps. Please don&apos;t open public issues for security
        bugs — see our <a href="/security">security page</a>.
      </p>

      <h2 id="bugs">Bugs & feature requests</h2>
      <p>
        Open an issue on{" "}
        <a href="https://github.com/Official-Krish/hive/issues">GitHub</a> —
        public tracker, public discussion. For workspace-specific problems,
        include your workspace slug and roughly when it happened.
      </p>

      <h2 id="social">Elsewhere</h2>
      <ul>
        <li>
          GitHub —{" "}
          <a href="https://github.com/Official-Krish/hive">github.com</a>
        </li>
        <li>
          X — <a href="https://x.com/KrishAnand0103">x.com</a>
        </li>
        <li>
          LinkedIn — <a href="https://linkedin.com">linkedin.com</a>
        </li>
      </ul>
    </StaticPage>
  );
}

export default ContactPage;
