import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiArrowDown } from "react-icons/fi";
import { CHAPTERS } from "./chapters";
import { cn } from "@/lib/utils";

/**
 * THE REEL — a scroll-driven story in 8 scenes.
 *
 * One pinned stage (~900vh of scroll). Scroll position IS the playhead:
 * a rAF loop maps it to a global timestamp across all legs, seeks the
 * paused video to that frame, pushes the camera, and cross-cuts the
 * story titles. Nothing autoplays — stop scrolling and the story freezes.
 *
 * Legs have real, unequal durations (leg_2 runs ~20s, the rest ~8s),
 * so beat windows and the timecode are weighted by actual footage time.
 */

const LEG_COUNT = CHAPTERS.length;
const FALLBACK_LEG = 8;

export function ScrollFilm() {
  const sectionRef = useRef<HTMLElement>(null);
  const wrapRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const beatRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cameraRefs = useRef<(HTMLDivElement | null)[]>([]);

  // durations live in a ref for the rAF loop + state so the HUD re-renders
  const durationsRef = useRef<number[]>(Array(LEG_COUNT).fill(FALLBACK_LEG));
  const [durations, setDurations] = useState<number[]>(durationsRef.current);
  const total = durations.reduce((a, b) => a + b, 0);

  const [loaded, setLoaded] = useState(0);
  const [ready, setReady] = useState(false);
  const [bar, setBar] = useState(0);
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── The scrub engine ──────────────────────────────────────────
  useEffect(() => {
    if (reduced || !ready) return;
    const section = sectionRef.current;
    if (!section) return;

    let raf = 0;
    let smooth = 0;
    let target = 0;
    let currentLeg = -1;

    const measure = () => {
      const rect = section.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      target = Math.min(1, Math.max(0, -rect.top / Math.max(1, scrollable)));
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);

    const legStartOf = (leg: number) => {
      let s = 0;
      for (let i = 0; i < leg; i++) s += durationsRef.current[i]!;
      return s;
    };

    const tick = () => {
      smooth += (target - smooth) * 0.14;
      if (Math.abs(target - smooth) < 0.0004) smooth = target;

      const totalDur = durationsRef.current.reduce((a, b) => a + b, 0);
      const t = smooth * totalDur;

      let leg = LEG_COUNT - 1;
      let acc = 0;
      for (let i = 0; i < LEG_COUNT; i++) {
        const d = durationsRef.current[i]!;
        if (t < acc + d || i === LEG_COUNT - 1) {
          leg = i;
          break;
        }
        acc += d;
      }
      const legStart = legStartOf(leg);
      const legDur = durationsRef.current[leg]!;
      const local = Math.min(Math.max(0, t - legStart), legDur);
      const legP = legDur > 0 ? local / legDur : 0;

      // match-cut: show exactly one wrapper
      if (leg !== currentLeg) {
        wrapRefs.current.forEach((w, i) => {
          if (!w) return;
          w.style.opacity = i === leg ? "1" : "0";
          w.style.zIndex = i === leg ? "2" : "1";
        });
        currentLeg = leg;
      }

      // scrub the visible frame (video stays paused — seek only)
      const v = videoRefs.current[leg];
      if (v && v.readyState >= 2 && Math.abs(v.currentTime - local) > 0.04) {
        try {
          v.currentTime = local;
        } catch {
          /* busy — retry next frame */
        }
      }

      // camera: slow push-in + alternating drift, per scene
      const cam = cameraRefs.current[leg];
      if (cam) {
        const dir = leg % 2 === 0 ? 1 : -1;
        cam.style.transform = `scale(${(1.1 - 0.08 * legP).toFixed(4)}) translateX(${(dir * legP * 1.5).toFixed(3)}%)`;
      }

      // story titles: duration-weighted windows so copy follows footage
      for (let i = 0; i < LEG_COUNT; i++) {
        const el = beatRefs.current[i];
        if (!el) continue;
        const s = legStartOf(i);
        const d = durationsRef.current[i]!;
        const pad = i === 0 || i === LEG_COUNT - 1 ? 0 : 0.05 * d;
        const edge = Math.max(0.004, (0.05 * d) / totalDur);
        // opening title is up from the very first frame (window opens before 0)
        const w0 = (s + pad) / totalDur - (i === 0 ? edge : 0);
        const w1 = (s + d - pad) / totalDur;
        let o = 0;
        if (smooth >= w0 && smooth <= w1) {
          o = Math.min((smooth - w0) / edge, (w1 - smooth) / edge, 1);
        }
        el.style.opacity = Math.max(0, Math.min(1, o)).toFixed(3);
        el.style.transform = `translateY(${((1 - Math.min(1, o)) * 32).toFixed(1)}px)`;
        el.style.visibility = o <= 0.01 ? "hidden" : "visible";
      }

      setBar((prev) => (Math.abs(prev - smooth) > 0.002 ? smooth : prev));

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [reduced, ready]);

  // reveal as soon as the opening frame can play — never hold the story hostage
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 6000);
    return () => clearTimeout(t);
  }, []);

  const onMeta = (i: number, d: number) => {
    if (Number.isFinite(d) && d > 0) {
      durationsRef.current[i] = d;
      setDurations([...durationsRef.current]);
    }
  };

  const fmt = (sec: number) =>
    `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

  // ── Reduced motion: calm column of stills ─────────────────────
  if (reduced) {
    return (
      <section id="film" className="relative bg-[#08090D]">
        {CHAPTERS.map((c) => (
          <div
            key={c.video}
            className="relative flex min-h-screen items-center px-4 sm:px-8 py-24"
          >
            <img
              src={c.poster}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-50"
            />
            <div className="absolute inset-0 bg-black/55" />
            <div className="relative max-w-md">
              <div className="mb-3 font-mono text-[11px] tracking-[0.18em] uppercase text-white/40">
                {c.eyebrow}
              </div>
              <h2 className="text-2xl font-medium text-white/90">{c.title}</h2>
              <p className="mt-3 text-sm text-white/55">{c.body}</p>
            </div>
          </div>
        ))}
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      id="film"
      className="relative bg-[#08090D] h-[900vh]"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* ── Legs ── */}
        <div className="absolute inset-0">
          {CHAPTERS.map((c, i) => (
            <div
              key={c.video}
              ref={(el) => {
                wrapRefs.current[i] = el;
              }}
              className="absolute inset-0"
              style={{ opacity: i === 0 ? 1 : 0, zIndex: i === 0 ? 2 : 1 }}
            >
              <div
                ref={(el) => {
                  cameraRefs.current[i] = el;
                }}
                className="absolute inset-0 will-change-transform"
              >
                <img
                  src={c.poster}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <video
                  ref={(el) => {
                    videoRefs.current[i] = el;
                  }}
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ opacity: 0 }}
                  src={c.video}
                  muted
                  playsInline
                  preload="auto"
                  disablePictureInPicture
                  onLoadedMetadata={(e) => onMeta(i, e.currentTarget.duration)}
                  onSeeked={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                  onCanPlayThrough={() => {
                    setLoaded((n) => Math.min(LEG_COUNT, n + 1));
                    if (i === 0) setReady(true);
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Grade */}
        <div className="pointer-events-none absolute inset-0 z-[3] bg-gradient-to-b from-black/60 via-transparent to-black/70" />

        {/* ── Story titles: full-bleed typography, no cards ── */}
        <div className="pointer-events-none absolute inset-0 z-[4]">
          {CHAPTERS.map((c, i) => {
            const isLast = i === LEG_COUNT - 1;
            return (
              <div
                key={c.scene}
                className={cn(
                  "absolute inset-0 flex flex-col justify-end px-5 sm:px-10 lg:px-16 pb-24 sm:pb-20",
                  c.align === "right" && "items-end text-right",
                  c.align === "left" && "items-start text-left",
                  c.align === "center" && "items-center text-center",
                )}
              >
                <div
                  ref={(el) => {
                    beatRefs.current[i] = el;
                  }}
                  data-beat={i}
                  className={cn(
                    "relative max-w-2xl",
                    c.align === "center" && "mx-auto",
                  )}
                  style={{ opacity: i === 0 ? 1 : 0 }}
                >
                  <div className="font-mono text-[10px] sm:text-[11px] tracking-[0.22em] uppercase text-white/50">
                    <span className="normal-case tracking-normal text-white/40">
                      {c.eyebrow}
                    </span>
                  </div>
                  <h2
                    className="mt-3 font-sans font-semibold leading-[1.02] tracking-[-0.03em] text-white text-balance text-4xl sm:text-6xl"
                    style={{ textShadow: "0 2px 40px rgba(0,0,0,0.8)" }}
                  >
                    {c.title}{" "}
                    {c.accent && (
                      <span className="text-white/60">{c.accent}</span>
                    )}
                  </h2>
                  <p
                    className="mt-3 max-w-xl text-sm sm:text-[15px] leading-relaxed text-white/60"
                    style={{ textShadow: "0 1px 20px rgba(0,0,0,0.9)" }}
                  >
                    {c.body}
                  </p>
                  <div className="mt-3 font-mono text-[10px] sm:text-[11px] tracking-[0.08em] text-white/35">
                    {c.proof.join("  ·  ")}
                  </div>

                  {i === 0 && (
                    <div className="mt-5 flex items-center gap-2 text-xs text-white/45">
                      <FiArrowDown className="animate-bounce" /> scroll — you
                      are playing this film
                    </div>
                  )}

                  {isLast && (
                    <div className="pointer-events-auto mt-6 flex flex-wrap items-center gap-2.5 justify-center">
                      <Link
                        to="/auth"
                        className="group inline-flex items-center gap-2 rounded-full bg-white/[0.92] px-6 py-3 text-[13px] font-medium text-black transition hover:bg-white"
                      >
                        Launch your floor
                        <FiArrowRight className="transition-transform group-hover:translate-x-0.5" />
                      </Link>
                      <a
                        href="#proof"
                        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-5 py-3 text-[13px] text-white/70 backdrop-blur transition hover:bg-white/[0.1] hover:text-white/90"
                      >
                        See the proof
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── HUD ── */}
        <div className="absolute inset-x-0 top-0 z-[5] flex items-center justify-between px-4 sm:px-8 pt-20 sm:pt-24 pb-3 font-mono text-[10px] sm:text-[11px] tracking-[0.16em] text-white/45 uppercase">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            <span>Hive · a story in 8 scenes</span>
          </div>
          <div className="tabular-nums text-white/40">
            {fmt(bar * total)} / {fmt(total)}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-[5] flex items-center gap-3 px-4 sm:px-8 pb-6">
          <div className="relative h-px flex-1 bg-white/10">
            <div
              className="absolute left-0 top-0 h-px bg-white/60"
              style={{ width: `${bar * 100}%` }}
            />
          </div>
          <div className="hidden sm:block font-mono text-[10px] tracking-[0.16em] text-white/30">
            Scroll to play
          </div>
        </div>

        {/* ── Loader: lifts the moment scene 1 can play ── */}
        <div
          className={cn(
            "absolute inset-0 z-[6] flex flex-col items-center justify-center gap-4 bg-[#08090D] transition-opacity duration-700",
            ready ? "pointer-events-none opacity-0" : "opacity-100",
          )}
        >
          <img
            src="https://cdn.krishlabs.tech/hive/assets/hero.png"
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover opacity-30"
          />
          <div className="relative max-w-xl px-6 text-center">
            <div className="font-mono text-[11px] tracking-[0.24em] uppercase text-white/50">
              Hive · a story in 8 scenes
            </div>
            <div className="mt-3 font-sans text-3xl sm:text-4xl font-semibold tracking-tight text-white">
              Your team is already building.
            </div>
          </div>
          <div className="relative h-px w-48 bg-white/10">
            <div
              className="h-px bg-white/70 transition-[width] duration-300"
              style={{ width: `${(loaded / LEG_COUNT) * 100}%` }}
            />
          </div>
          <div className="relative font-mono text-[11px] tabular-nums text-white/40">
            {loaded} / {LEG_COUNT} scenes
          </div>
        </div>
      </div>
    </section>
  );
}

export default ScrollFilm;
