import { Link } from "react-router-dom";
import { FaInstagram, FaLinkedin, FaSquareXTwitter } from "react-icons/fa6";

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
              We design and build workspaces that drive results
            </span>
          </div>

          {/* Links Columns */}
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 md:gap-0">
            <div className="flex flex-col gap-4">
              <h3 className="text-neutral-400 tracking-tight text-xs leading-5 font-medium">
                Home
              </h3>
              <ul className="flex flex-col gap-4">
                <li>
                  <a
                    className="text-white text-sm leading-5 font-medium hover:underline"
                    href="#"
                  >
                    Overview
                  </a>
                </li>
                <li>
                  <a
                    className="text-white text-sm leading-5 font-medium hover:underline"
                    href="#"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    className="text-white text-sm leading-5 font-medium hover:underline"
                    href="#"
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <a
                    className="text-white text-sm leading-5 font-medium hover:underline"
                    href="#"
                  >
                    Testimonials
                  </a>
                </li>
                <li>
                  <a
                    className="text-white text-sm leading-5 font-medium hover:underline"
                    href="#"
                  >
                    FAQs
                  </a>
                </li>
              </ul>
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="text-neutral-400 tracking-tight text-xs leading-5 font-medium">
                About
              </h3>
              <ul className="flex flex-col gap-4">
                <li>
                  <a
                    className="text-white text-sm leading-5 font-medium hover:underline"
                    href="#"
                  >
                    Our Story
                  </a>
                </li>
                <li>
                  <a
                    className="text-white text-sm leading-5 font-medium hover:underline"
                    href="#"
                  >
                    Team
                  </a>
                </li>
                <li>
                  <a
                    className="text-white text-sm leading-5 font-medium hover:underline"
                    href="#"
                  >
                    Careers
                  </a>
                </li>
                <li>
                  <a
                    className="text-white text-sm leading-5 font-medium hover:underline"
                    href="#"
                  >
                    Blog
                  </a>
                </li>
                <li>
                  <a
                    className="text-white text-sm leading-5 font-medium hover:underline"
                    href="#"
                  >
                    Press Kit
                  </a>
                </li>
              </ul>
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="text-neutral-400 tracking-tight text-xs leading-5 font-medium">
                Contact
              </h3>
              <ul className="flex flex-col gap-4">
                <li>
                  <a
                    className="text-white text-sm leading-5 font-medium hover:underline"
                    href="#"
                  >
                    Contact Us
                  </a>
                </li>
                <li>
                  <a
                    className="text-white text-sm leading-5 font-medium hover:underline"
                    href="#"
                  >
                    Support
                  </a>
                </li>
                <li>
                  <a
                    className="text-white text-sm leading-5 font-medium hover:underline"
                    href="#"
                  >
                    Live Chat
                  </a>
                </li>
                <li>
                  <a
                    className="text-white text-sm leading-5 font-medium hover:underline"
                    href="#"
                  >
                    Help Center
                  </a>
                </li>
                <li>
                  <a
                    className="text-white text-sm leading-5 font-medium hover:underline"
                    href="#"
                  >
                    Report Issue
                  </a>
                </li>
              </ul>
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="text-neutral-400 tracking-tight text-xs leading-5 font-medium">
                Legal
              </h3>
              <ul className="flex flex-col gap-4">
                <li>
                  <a
                    className="text-white text-sm leading-5 font-medium hover:underline"
                    href="#"
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    className="text-white text-sm leading-5 font-medium hover:underline"
                    href="#"
                  >
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a
                    className="text-white text-sm leading-5 font-medium hover:underline"
                    href="#"
                  >
                    Cookie Policy
                  </a>
                </li>
                <li>
                  <a
                    className="text-white text-sm leading-5 font-medium hover:underline"
                    href="#"
                  >
                    Licenses
                  </a>
                </li>
                <li>
                  <a
                    className="text-white text-sm leading-5 font-medium hover:underline"
                    href="#"
                  >
                    Security
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & Social Links */}
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

          {/* Social Icons */}
          <div className="flex items-center gap-5">
            <a target="_blank" rel="noopener noreferrer" href="https://x.com">
              <FaSquareXTwitter className="text-neutral-400 hover:text-white size-6 transition-colors" />
            </a>
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://linkedin.com"
            >
              <FaLinkedin className="text-neutral-400 hover:text-white size-6 transition-colors" />
            </a>
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://instagram.com"
            >
              <FaInstagram className="text-neutral-400 hover:text-white size-6 transition-colors" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
