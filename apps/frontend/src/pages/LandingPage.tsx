import { AppBar } from "@/components/layout/AppBar";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/landing/HeroSection";
import { MarqueeSection } from "@/components/landing/MarqueeSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { CollectorSection } from "@/components/landing/CollectorSection";
import { SpatialOfficeSection } from "@/components/landing/SpatialOfficeSection";
import { PrivacySection } from "@/components/landing/PrivacySection";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { CTASection } from "@/components/landing/CTASection";

export function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#08090D] text-slate-100 overflow-x-hidden selection:bg-cyan-500/25 selection:text-cyan-200">
      <AppBar />
      <main>
        <HeroSection />
        <MarqueeSection />
        <FeaturesSection />
        <CollectorSection />
        <SpatialOfficeSection />
        <PrivacySection />
        <ComparisonSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}

export default LandingPage;
