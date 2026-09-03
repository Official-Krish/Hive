export interface Chapter {
  index: number;
  scene: string;
  eyebrow: string;
  title: string;
  accent?: string;
  body: string;
  proof: string[];
  video: string;
  poster: string;
  align: "left" | "right" | "center";
}

/**
 * One continuous dolly through a single facility.
 * leg_N.mp4 is the motion continuation of the previous still —
 * so each beat's poster IS the first frame of its leg.
 * Hero still (CDN hero.png) → leg_1 is the opening match-cut.
 */
export const CHAPTERS: Chapter[] = [
  {
    index: 0,
    scene: "01",
    eyebrow: "Cold open · 00:00",
    title: "Your team is already building.",
    accent: "You just can't see it.",
    body: "Developers, Claude, Codex, Cursor — shipping in the dark. Hive is the camera that finally watches the floor.",
    proof: ["hive start", "2 min setup", "Claude · Codex · Cursor · OpenCode"],
    video: "https://cdn.krishlabs.tech/hive/assets/vid/leg_1.mp4",
    poster: "https://cdn.krishlabs.tech/hive/assets/hero.png",
    align: "left",
  },
  {
    index: 1,
    scene: "02",
    eyebrow: "The collector · local daemon",
    title: "A 20MB daemon that sees everything.",
    accent: "Ships nothing raw.",
    body: "A lightweight Rust agent watches git, terminal, files, tests and AI sessions — then normalizes it into clean telemetry.",
    proof: [
      "hive start / stop",
      "agent.* · git.* · test.*",
      "offline-first, batched",
    ],
    video: "https://cdn.krishlabs.tech/hive/assets/vid/leg_2.mp4",
    poster: "https://cdn.krishlabs.tech/hive/assets/still_2_collector.png",
    align: "right",
  },
  {
    index: 2,
    scene: "03",
    eyebrow: "Telemetry pipeline · idempotent ingest",
    title: "Noise in. Signal out.",
    body: "Device-authenticated, batched, idempotent ingest. Every event lands exactly once — then fans out to Postgres, Redis and the live floor.",
    proof: ["X-Device-Token", "exactly-once", "REST :4000 · WS :4001"],
    video: "https://cdn.krishlabs.tech/hive/assets/vid/leg_3.mp4",
    poster: "https://cdn.krishlabs.tech/hive/assets/still_3_telemetry.png",
    align: "left",
  },
  {
    index: 3,
    scene: "04",
    eyebrow: "The AI lab · spatial office",
    title: "Know what's happening,",
    accent: "without asking.",
    body: "Presence, avatars, live summaries — humans and agents together in one living workspace. No status meeting required.",
    proof: ["live map", "agent summaries", "remote shutdown from dashboard"],
    video: "https://cdn.krishlabs.tech/hive/assets/vid/leg_4.mp4",
    poster: "https://cdn.krishlabs.tech/hive/assets/still_4_ai_lab.png",
    align: "right",
  },
  {
    index: 4,
    scene: "05",
    eyebrow: "Engineering intelligence · tokens → shipped",
    title: "Make every token count.",
    body: "1.84M tokens → 143 tasks → 38 PRs → 17 shipped. Token burn mapped directly to output, per model, per dev, per dollar.",
    proof: ["127 tasks today", "per-model usage", "sprint outcome meters"],
    video: "https://cdn.krishlabs.tech/hive/assets/vid/leg_5.mp4",
    poster: "https://cdn.krishlabs.tech/hive/assets/still_5_metrics.png",
    align: "left",
  },
  {
    index: 5,
    scene: "06",
    eyebrow: "GitHub native · push → PR",
    title: "GitHub isn't integrated.",
    accent: "It's the floor plan.",
    body: "OAuth App connect, per-repo webhooks, encrypted tokens. Pushes and PRs land on the floor the second they happen.",
    proof: [
      "push · pull_request",
      "tokens encrypted at rest",
      "per-repo webhooks",
    ],
    video: "https://cdn.krishlabs.tech/hive/assets/vid/leg_6.mp4",
    poster: "https://cdn.krishlabs.tech/hive/assets/still_6_github.png",
    align: "right",
  },
  {
    index: 6,
    scene: "07",
    eyebrow: "Privacy · server-side gates",
    title: "Observe everything.",
    accent: "Expose only what you allow.",
    body: "Per-workspace gates redact tokens, summaries, git metadata, file paths, commands and prompts — without changing response shape.",
    proof: [
      "code never leaves machine",
      "6 privacy switches",
      "role-ranked access",
    ],
    video: "https://cdn.krishlabs.tech/hive/assets/vid/leg_7.mp4",
    poster: "https://cdn.krishlabs.tech/hive/assets/still_7_privacy.png",
    align: "left",
  },
  {
    index: 7,
    scene: "08",
    eyebrow: "Finale · your floor",
    title: "Give your team a place to build.",
    body: "One command. One dashboard. One living office for humans and agents. Scroll's over — the shift starts now.",
    proof: [
      "open source contracts",
      "Bun · PG17 · Redis 7",
      "YC-grade boring infra",
    ],
    video: "https://cdn.krishlabs.tech/hive/assets/vid/leg_8.mp4",
    poster: "https://cdn.krishlabs.tech/hive/assets/still_8_hero_product.png",
    align: "center",
  },
];
