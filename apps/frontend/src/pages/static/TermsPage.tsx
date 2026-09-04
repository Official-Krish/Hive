import { StaticPage } from "@/components/layout/StaticPage";

const SECTIONS = [
  { id: "service", label: "The service" },
  { id: "accounts", label: "Accounts & access" },
  { id: "collector", label: "Collector software" },
  { id: "acceptable", label: "Acceptable use" },
  { id: "ip", label: "Intellectual property" },
  { id: "liability", label: "Liability" },
  { id: "changes", label: "Changes" },
  { id: "contact", label: "Contact" },
];

export function TermsPage() {
  return (
    <StaticPage
      eyebrow="Legal · Terms"
      title="Terms of Service"
      description="The rules for using Hive — accounts, the collector, and what's yours versus ours."
      updated="September 2026"
      sections={SECTIONS}
    >
      <h2 id="service">The service</h2>
      <p>
        Hive provides an engineering intelligence platform: a local collector, a
        cloud API and dashboard, and a realtime spatial office. By creating an
        account or running the collector, you agree to these terms.
      </p>

      <h2 id="accounts">Accounts &amp; access</h2>
      <ul>
        <li>
          You must provide an accurate email and keep your credentials safe.
        </li>
        <li>
          Workspaces have role-based access (owner, admin, maintainer,
          developer, member, viewer). You may only exercise the permissions of
          the roles you hold.
        </li>
        <li>
          Accepting a workspace invite requires a connected, online collector on
          your machine.
        </li>
        <li>We may suspend accounts that abuse the service or other users.</li>
      </ul>

      <h2 id="collector">Collector software</h2>
      <p>
        The collector is open tooling you run on your own machines. It sends
        telemetry only to the Hive backend you configure, using device-scoped
        credentials. You are responsible for running it on machines you own or
        administer, and for complying with your employer's policies when you do.
      </p>

      <h2 id="acceptable">Acceptable use</h2>
      <ul>
        <li>Don't probe, disrupt, or overload the service.</li>
        <li>
          Don't collect telemetry from machines or people without consent.
        </li>
        <li>Don't use Hive to exfiltrate data you have no right to access.</li>
        <li>
          Don't misrepresent agent or human activity in shared workspaces.
        </li>
      </ul>

      <h2 id="ip">Intellectual property</h2>
      <p>
        Your code and data remain yours. Hive claims no ownership over your
        repositories, telemetry content, or workspace data. The Hive platform,
        branding, and collector distribution tooling remain ours (the collector
        client source is MIT-licensed where marked).
      </p>

      <h2 id="liability">Liability</h2>
      <p>
        The service is provided "as is", without warranties. To the maximum
        extent permitted by law, Hive is not liable for indirect or
        consequential damages, including lost code, lost data, or lost
        productivity.
      </p>

      <h2 id="changes">Changes</h2>
      <p>
        We may update these terms as the product evolves. Material changes will
        be announced in the product; continued use after changes take effect
        constitutes acceptance.
      </p>

      <h2 id="contact">Contact</h2>
      <p>
        Questions about these terms:{" "}
        <a href="mailto:contact@hive.dev">contact@hive.dev</a>.
      </p>
    </StaticPage>
  );
}

export default TermsPage;
