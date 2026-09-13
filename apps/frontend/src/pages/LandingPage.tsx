import { MotionConfig } from "motion/react";
import { ScrollFilm } from "@/components/landing/cinematic/ScrollFilm";
import { MobileHero } from "@/components/landing/MobileHero";
import { Faq } from "@/components/landing/Faq";
import { CTA } from "@/components/landing/CTA";
import { useLenis } from "@/hooks/useLenis";
import { useIsMobile } from "@/hooks/useIsMobile";
import { usePageMeta } from "@/hooks/usePageMeta";

export function LandingPage() {
  const isMobile = useIsMobile();
  useLenis(!isMobile);
  usePageMeta(
    "Engineering intelligence for AI-native teams",
    "Hive turns AI-coding activity into a living team dashboard — collector telemetry, token spend, Watchdog alerts, PR reviews, and a spatial office for humans and agents.",
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen bg-[#08090D] text-slate-100 overflow-x-clip selection:bg-white/20 selection:text-white">
        <main>
          {isMobile ? (
            <>
              <MobileHero />
              <Faq />
              <CTA />
            </>
          ) : (
            <>
              <ScrollFilm />
              <Faq />
              <CTA />
            </>
          )}
        </main>
      </div>
    </MotionConfig>
  );
}

export default LandingPage;
