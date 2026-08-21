import { Activity } from "@/components/landing/Activity";
import { HeroSection } from "@/components/landing/HeroSection";
import { Product } from "@/components/landing/Product";
import { Insights } from "@/components/landing/Insights";
import { Faq } from "@/components/landing/Faq";
import { CTA } from "@/components/landing/CTA";

export function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#08090D] text-slate-100 overflow-x-hidden selection:bg-white/20 selection:text-white">
      <main>
        <HeroSection />
        <Product />
        <Activity />
        <Insights />
        <Faq />
        <CTA />
      </main>
    </div>
  );
}

export default LandingPage;
