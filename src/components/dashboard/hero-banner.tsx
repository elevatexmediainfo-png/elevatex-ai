import { AmbientBackground } from "@/components/dashboard/ambient-background";
import { HeroPromptBox } from "@/components/dashboard/hero-prompt-box";
import type { ContinueWorkingItem } from "@/lib/dashboard/continue-working";

interface HeroBannerProps {
  displayName: string;
  recentItem: ContinueWorkingItem | null;
}

// PRD Milestone 2 — Hero is now the dominant full-width creation surface.
// Old two-column layout (prompt left / decorative preview right) replaced by
// a single centered column so the prompt box occupies the visual focus.
// AmbientBackground is kept — pure CSS/transform animations, zero layout.
export function HeroBanner({ displayName, recentItem }: HeroBannerProps) {
  return (
    <section
      aria-label="Create"
      className="relative overflow-hidden"
    >
      <AmbientBackground />

      {/* Max 880px keeps the prompt box wide-but-focused; mx-auto centers it */}
      <div className="relative mx-auto w-full max-w-[880px] px-4 md:px-6 py-12 md:py-16 lg:py-20">
        <HeroPromptBox displayName={displayName} recentItem={recentItem} />
      </div>
    </section>
  );
}
