import { useState } from "react";
import { Link } from "react-router-dom";
import { FiCheck, FiCopy } from "react-icons/fi";
import { StaticPage } from "@/components/layout/StaticPage";

const SECTIONS = [
  { id: "email", label: "Email" },
  { id: "security", label: "Security issues" },
  { id: "bugs", label: "Bugs & features" },
  { id: "social", label: "Elsewhere" },
];

export function ContactPage() {
  return (
    <StaticPage
      eyebrow="Company · Contact"
      title="Talk to us"
      description="Questions, feedback, security reports, partnership ideas — one inbox, real humans."
      sections={SECTIONS}
      cta={false}
    >
      <h2 id="email">Email</h2>
      <p>
        <CopyEmail address="contact@hive.dev" /> — we read everything and reply
        within two business days.
      </p>

      <h2 id="security">Security issues</h2>
      <p>
        Send vulnerabilities straight to{" "}
        <CopyEmail address="security@hive.dev" /> with details and reproduction
        steps. Please don&apos;t open public issues for security bugs — see our{" "}
        <Link to="/security">security page</Link>.
      </p>

      <h2 id="bugs">Bugs & feature requests</h2>
      <p>
        Open an issue on{" "}
        <a
          href="https://github.com/Official-Krish/hive/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>{" "}
        — public tracker, public discussion. For workspace-specific problems,
        include your workspace slug and roughly when it happened.
      </p>

      <h2 id="social">Elsewhere</h2>
      <ul>
        <li>
          GitHub —{" "}
          <a
            href="https://github.com/Official-Krish/hive"
            target="_blank"
            rel="noopener noreferrer"
          >
            Official-Krish/hive
          </a>
        </li>
        <li>
          X —{" "}
          <a
            href="https://x.com/KrishAnand0103"
            target="_blank"
            rel="noopener noreferrer"
          >
            @KrishAnand0103
          </a>
        </li>
      </ul>
    </StaticPage>
  );
}

function CopyEmail({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — mailto still works */
    }
  };
  return (
    <span className="inline-flex items-center gap-2">
      <a href={`mailto:${address}`}>{address}</a>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : `Copy ${address}`}
        className="inline-flex items-center gap-1 font-mono text-[11px] text-white/40 transition-colors hover:text-white"
      >
        {copied ? (
          <FiCheck className="size-3.5 text-emerald-400" />
        ) : (
          <FiCopy className="size-3.5" />
        )}
        {copied ? "copied" : "copy"}
      </button>
    </span>
  );
}

export default ContactPage;
