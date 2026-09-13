import { useState, type ReactNode } from "react";
import { FiCheck, FiCopy } from "react-icons/fi";
import { StaticPage } from "@/components/layout/StaticPage";

const SECTIONS = [
  { id: "install", label: "Install" },
  { id: "login", label: "Log in" },
  { id: "start", label: "Start collecting" },
  { id: "agents", label: "Supported tools" },
  { id: "commands", label: "Command reference" },
  { id: "verify", label: "Verify" },
  { id: "config", label: "Configuration" },
];

export function InstallPage() {
  return (
    <StaticPage
      eyebrow="Docs · Getting started"
      title="Install the collector"
      description="One line installs hive. Two commands connect it. Your office goes live."
      updated="September 2026"
      sections={SECTIONS}
    >
      <h2 id="install">Install</h2>
      <p>Run this on your machine:</p>
      <CodeBlock text="curl -fsSL https://cdn.krishlabs.tech/hive/collector/install.sh | bash">
        curl -fsSL https://cdn.krishlabs.tech/hive/collector/install.sh | bash
      </CodeBlock>
      <p>
        This installs <code>hive</code> into <code>~/.local/bin</code>. The
        script is served over HTTPS from our CDN; prefer building from source?
        See the collector README in the repository (<code>apps/collector</code>)
        — <code>cargo build --release</code> and symlink the binary onto your{" "}
        <code>PATH</code>.
      </p>

      <h2 id="login">Log in</h2>
      <CodeBlock text="hive login">hive login</CodeBlock>
      <p>
        This starts a GitHub device flow: open the shown URL, enter the code,
        and you're linked. No secrets leave your machine — the CLI is a public
        client.
      </p>

      <h2 id="start">Start collecting</h2>
      <CodeBlock text="hive start">hive start</CodeBlock>
      <p>
        First run registers your machine and asks which workspace to join, then
        starts the background daemon. Check it with <code>hive status</code>,
        stop it with <code>hive stop</code>. Accepting a workspace invite
        requires an online collector — this is that step.
      </p>
      <p>
        Optional terminal capture: <code>hive install-hook</code> appends a
        shell hook so terminal commands are observed too.
      </p>

      <h2 id="agents">Supported tools</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>What&apos;s observed</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Claude Code</td>
              <td>Session starts, summaries, token usage</td>
            </tr>
            <tr>
              <td>Codex</td>
              <td>Session activity</td>
            </tr>
            <tr>
              <td>OpenCode</td>
              <td>Project messages and sessions</td>
            </tr>
            <tr>
              <td>Git</td>
              <td>Commits, branches</td>
            </tr>
            <tr>
              <td>Filesystem</td>
              <td>File modifications (ignores .git, node_modules, target…)</td>
            </tr>
            <tr>
              <td>Terminal</td>
              <td>Commands and processes (with shell hook)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="commands">Command reference</h2>
      <CodeBlock
        text={`hive login          # GitHub device flow, once
hive start          # register + start the daemon
hive status         # running? connected?
hive stop           # stop the daemon
hive run            # foreground (debug logs)
hive install-hook   # terminal capture for zsh/bash
hive logout         # sign out on this machine`}
      >{`hive login          # GitHub device flow, once
hive start          # register + start the daemon
hive status         # running? connected?
hive stop           # stop the daemon
hive run            # foreground (debug logs)
hive install-hook   # terminal capture for zsh/bash
hive logout         # sign out on this machine`}</CodeBlock>

      <h2 id="verify">Verify</h2>
      <p>
        Run <code>hive status</code> — you should see the daemon running,
        connected, and an empty outbox. Then open your workspace: your avatar
        appears on the floor within a minute. If the collector reports a
        rejected token, re-run <code>hive start</code> to re-register the
        machine.
      </p>

      <h2 id="config">Configuration</h2>
      <p>
        Defaults just work against the hosted backend. Power users can tune{" "}
        <code>~/.config/hive/config.toml</code> — API/WS URLs, poll intervals,
        flush batching, and watch paths. Device credentials never leave{" "}
        <code>~/.local/state/hive/</code>; treat that directory as sensitive.
      </p>
    </StaticPage>
  );
}

function CodeBlock({ text, children }: { text: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — selection still works */
    }
  };
  return (
    <div className="relative">
      <pre className="pr-14">
        <code>{children}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy code"}
        className="absolute right-3 top-3 flex items-center gap-1.5 font-mono text-[11px] text-white/40 transition-colors hover:text-white"
      >
        {copied ? (
          <FiCheck className="size-3.5 text-emerald-400" />
        ) : (
          <FiCopy className="size-3.5" />
        )}
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}

export default InstallPage;
