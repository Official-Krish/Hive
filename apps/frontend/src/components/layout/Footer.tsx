import { Link } from "react-router-dom";
import { FaGithub, FaLinkedin, FaSquareXTwitter } from "react-icons/fa6";

const COLUMNS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Install", to: "/install" },
      { label: "Security", to: "/security" },
      { label: "Status", to: "/status" },
      { label: "Launch app", to: "/auth" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Contact", to: "/contact" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Install guide", to: "/install" },
      {
        label: "Report an issue",
        to: "https://github.com/Official-Krish/hive/issues",
      },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Terms of Service", to: "/terms" },
    ],
  },
];

export const Footer = () => {
  return (
    <div
      data-slot="container"
      className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex flex-col gap-20 sm:gap-30 pt-16 sm:pt-20 pb-10"
    >
      <div className="relative z-10 flex flex-col items-center justify-center gap-12 sm:gap-18">
        <div className="grid w-full grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-0">
          <div className="flex flex-col gap-4">
            <Link
              className="flex items-center gap-2 font-bold text-xl text-white"
              to="/"
            >
              <span>Hive</span>
            </Link>
            <span className="text-neutral-400 text-sm leading-5">
              Where your team and AI agents build together.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 md:gap-0">
            {COLUMNS.map((col) => (
              <div key={col.title} className="flex flex-col gap-4">
                <h3 className="text-neutral-400 tracking-tight text-xs leading-5 font-medium">
                  {col.title}
                </h3>
                <ul className="flex flex-col gap-4">
                  {col.links.map((l) =>
                    l.to.startsWith("http") ? (
                      <li key={l.label}>
                        <a
                          className="text-white text-sm leading-5 font-medium hover:underline"
                          href={l.to}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {l.label}
                        </a>
                      </li>
                    ) : (
                      <li key={l.label}>
                        <Link
                          className="text-white text-sm leading-5 font-medium hover:underline"
                          to={l.to}
                        >
                          {l.label}
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex w-full flex-col justify-between gap-6 md:flex-row md:items-center md:gap-0 pt-6 border-t border-white/10">
          <div>
            <span className="flex items-center gap-1">
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g clipPath="url(#clip0_2623_9646)">
                  <path
                    d="M6 11C8.76142 11 11 8.76142 11 6C11 3.23858 8.76142 1 6 1C3.23858 1 1 3.23858 1 6C1 8.76142 3.23858 11 6 11Z"
                    stroke="#8B8B8B"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M7.41343 7.415C7.13363 7.69448 6.77726 7.88474 6.38936 7.96173C6.00146 8.03872 5.59944 7.99899 5.23412 7.84755C4.8688 7.69611 4.55657 7.43976 4.33691 7.11091C4.11724 6.78206 4 6.39547 4 6C4 5.60453 4.11724 5.21794 4.33691 4.88909C4.55657 4.56024 4.8688 4.3039 5.23412 4.15245C5.59944 4.00101 6.00146 3.96128 6.38936 4.03827C6.77726 4.11526 7.13363 4.30552 7.41343 4.585"
                    stroke="#8B8B8B"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_2623_9646">
                    <rect width="12" height="12" fill="white" />
                  </clipPath>
                </defs>
              </svg>
              <span className="text-neutral-400 text-xs leading-5 font-medium">
                2026 Hive All Rights Reserved
              </span>
            </span>
          </div>

          <div className="flex items-center gap-5">
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://x.com/KrishAnand0103"
              aria-label="Hive on X"
            >
              <FaSquareXTwitter className="text-neutral-400 hover:text-white size-6 transition-colors" />
            </a>
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://linkedin.com"
              aria-label="Hive on LinkedIn"
            >
              <FaLinkedin className="text-neutral-400 hover:text-white size-6 transition-colors" />
            </a>
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://github.com/Official-Krish/hive/"
              aria-label="Hive on GitHub"
            >
              <FaGithub className="text-neutral-400 hover:text-white size-6 transition-colors" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
