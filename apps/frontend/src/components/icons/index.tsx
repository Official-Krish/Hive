import { cn } from "@/lib/utils";

type HiveLogoProps = {
  className?: string;
  size?: number;
};

export function HiveLogo({ className, size = 32 }: HiveLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient
          id="hivePrismGrad"
          x1="2"
          y1="2"
          x2="30"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#00F2FE" />
          <stop offset="0.5" stopColor="#38BDF8" />
          <stop offset="1" stopColor="#818CF8" />
        </linearGradient>
        <linearGradient
          id="hiveInnerGrad"
          x1="8"
          y1="8"
          x2="24"
          y2="24"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#38BDF8" stopOpacity="0.4" />
          <stop offset="1" stopColor="#818CF8" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      {/* Outer Hex Prism */}
      <path
        d="M16 2L28.5 9.2V22.8L16 30L3.5 22.8V9.2L16 2Z"
        stroke="url(#hivePrismGrad)"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      {/* Inner Dynamic Facets */}
      <path
        d="M16 2V16M28.5 22.8L16 16M3.5 22.8L16 16"
        stroke="url(#hivePrismGrad)"
        strokeWidth="1.2"
        strokeOpacity="0.7"
      />
      <polygon
        points="16,8 23,12 23,20 16,24 9,20 9,12"
        fill="url(#hiveInnerGrad)"
        stroke="url(#hivePrismGrad)"
        strokeWidth="1"
      />
      <circle cx="16" cy="16" r="3" fill="#00F2FE" className="animate-pulse" />
    </svg>
  );
}

export function CyberGridPattern({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <pattern
          id="cyberGrid"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.75"
            strokeOpacity="0.1"
          />
          <circle cx="40" cy="40" r="1" fill="currentColor" opacity="0.3" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#cyberGrid)" />
    </svg>
  );
}

export function GlowingBeamFlow({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      preserveAspectRatio="none"
    >
      <path
        d="M0 60C150 20 250 100 400 60C550 20 650 100 800 60"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.15"
      />
      <path
        d="M0 60C150 20 250 100 400 60C550 20 650 100 800 60"
        stroke="url(#beamFlowGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="12 28"
      />
      <defs>
        <linearGradient id="beamFlowGrad" x1="0" y1="0" x2="800" y2="0">
          <stop stopColor="#00F2FE" stopOpacity="0" />
          <stop offset="0.3" stopColor="#00F2FE" />
          <stop offset="0.7" stopColor="#818CF8" />
          <stop offset="1" stopColor="#C084FC" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function TelemetryPulse({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 40" fill="none" className={className} aria-hidden>
      <path
        d="M0 20H24L30 6L38 34L46 12L54 28L60 20H120"
        stroke="url(#telePulseGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="60" cy="20" r="3.5" fill="#00F2FE" />
      <defs>
        <linearGradient
          id="telePulseGrad"
          x1="0"
          y1="20"
          x2="120"
          y2="20"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#38BDF8" stopOpacity="0.2" />
          <stop offset="0.5" stopColor="#00F2FE" />
          <stop offset="1" stopColor="#818CF8" stopOpacity="0.2" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function AmbientGlowBlob({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none rounded-full filter blur-[100px] opacity-25 mix-blend-screen",
        className,
      )}
      style={{
        background:
          "radial-gradient(circle, rgba(56,189,248,0.8) 0%, rgba(129,140,248,0.4) 50%, transparent 80%)",
      }}
    />
  );
}
