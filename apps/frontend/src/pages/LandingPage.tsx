import { ScrollFilm } from "@/components/landing/cinematic/ScrollFilm";
import { MobileHero } from "@/components/landing/MobileHero";
import { Faq } from "@/components/landing/Faq";
import { CTA } from "@/components/landing/CTA";
import { useLenis } from "@/hooks/useLenis";
import { useIsMobile } from "@/hooks/useIsMobile";

export function LandingPage() {
  const isMobile = useIsMobile();
  useLenis(!isMobile);

  return (
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
  );
}

export default LandingPage;
