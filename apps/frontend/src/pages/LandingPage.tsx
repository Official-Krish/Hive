import { ScrollFilm } from "@/components/landing/cinematic/ScrollFilm";
import { Faq } from "@/components/landing/Faq";
import { CTA } from "@/components/landing/CTA";
import { useLenis } from "@/hooks/useLenis";

/**
 * HIVE landing — v2 cinematic.
 *
 * Act I  — THE FILM: 8-leg continuous scroll dolly (sticky video
 *          stage + 8 copy beats, posters = first frames).
 * Act II — THE PROOF: live Activity bezel + token-flow Insights
 *          for scanners, SEO and skeptics.
 * Act III — CLOSE: FAQ + CTA.
 */
export function LandingPage() {
  useLenis(true);
  return (
    <div className="relative min-h-screen bg-[#08090D] text-slate-100 overflow-x-clip selection:bg-white/20 selection:text-white">
      <main>
        <ScrollFilm />
        <Faq />
        <CTA />
      </main>
    </div>
  );
}

export default LandingPage;
