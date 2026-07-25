import { Container } from "@/components/shared/container";
import { GradientToolCard } from "@/components/dashboard/gradient-tool-card";

// 4-option restructure Step 2 (2026-07-11) — replaces the temporary
// redirect stub from Step 1. Every entry point that had a specific
// pre-fill intent (Dashboard Quick Actions, the templates gallery, the
// hero prompt box's classified-VIDEO branch) already points straight at
// /create/video and bypasses this screen entirely — this page is reached
// only by the 5 deliberately generic entry points (top-nav "Create",
// /studio's CTA, /projects' empty-state, tool-routing.ts's VIDEO fallback,
// /videos' non-Talking-Head CTA), exactly the cases where letting the user
// choose a mode first is the right behavior.
//
// Reuses GradientToolCard verbatim (the same component the Dashboard's own
// Quick Create grid uses) rather than a new card component — same visual
// language, zero new design system surface. AI Video is marked flagship
// here specifically (not copying QuickCreateGrid's own TALKING_HEAD
// flagship choice) because it's the one fully built, live-verified option
// today; the other three are real but newer/smaller (Animated Poster),
// already-existing-but-secondary (Talking Head), or not yet built (Film).
const OPTIONS = [
  {
    href: "/create/video",
    icon: "Film",
    label: "AI Video",
    description: "Describe your idea — get a ready 8-second AI video with speech and sound.",
    gradientFrom: "#6366f1",
    gradientTo: "#a855f7",
    creditCostEstimate: 20,
    creditLabel: "20 credits per video",
    flagship: true,
  },
  {
    href: "/create/animated-poster",
    icon: "Image",
    label: "Animated Poster Video",
    description: "Animate one of your posters into a short video.",
    gradientFrom: "#f59e0b",
    gradientTo: "#ef4444",
    creditCostEstimate: 2,
  },
  {
    // Fix (2026-07-18) — this tile's own copy ("Upload your own footage —
    // AI edits, captions, and polishes it") describes Phase 12's AI
    // Auto-Edit feature, but it used to point at /create/talking-head, the
    // separate, unrelated legacy Scene-based Talking Head flow — a real
    // bug (confirmed live: a real user ended up on the wrong feature
    // entirely), not a deliberate choice. Repointed to /create/ai-auto-edit,
    // which creates a real Cloud Editor project and opens the actual AI
    // Auto-Edit panel — see that route's own doc comment. The legacy
    // Talking Head flow this tile used to lead to has NO tile of its own
    // anymore as of this fix — flagged in PROJECT_STATUS.md as a real,
    // separate product decision (a new tile with honest copy, or another
    // entry point), not silently dropped or silently merged into this one.
    href: "/create/ai-auto-edit",
    icon: "Clapperboard",
    label: "Upload Your Video",
    description: "Upload your own footage — AI edits, captions, and polishes it.",
    gradientFrom: "#8b5cf6",
    gradientTo: "#6366f1",
    creditCostEstimate: 0,
    // Genuinely free to start — creating a project and opening the AI
    // Auto-Edit panel costs nothing; real cost only applies once the
    // pipeline actually runs (Phase 12 Module 10's cost preview shows the
    // real number before Apply).
    creditLabel: "Free to start",
  },
  {
    href: "/create/film",
    icon: "Clapperboard",
    label: "AI Film",
    description: "Generate a full multi-scene film with characters and a storyboard.",
    gradientFrom: "#eab308",
    gradientTo: "#f97316",
    creditCostEstimate: 0,
    // Not priced yet — Phase 5/6, not built. Real intro page at
    // /create/film (not a dead "coming soon"), pricing lands once that
    // work is actually scoped.
    creditLabel: "Pricing TBD",
  },
] as const;

export default function CreateSelectorPage() {
  return (
    <Container className="flex flex-col gap-8 py-10">
      <div>
        <h1 className="text-heading-1 text-dash-ink">What do you want to create?</h1>
        <p className="mt-2 text-body-md text-dash-ink/60">
          Pick a starting point — each one leads to its own flow.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {OPTIONS.map((option) => (
          <GradientToolCard
            key={option.href}
            href={option.href}
            icon={option.icon}
            label={option.label}
            description={option.description}
            gradientFrom={option.gradientFrom}
            gradientTo={option.gradientTo}
            creditCostEstimate={option.creditCostEstimate}
            creditLabel={"creditLabel" in option ? option.creditLabel : undefined}
            estimatedSeconds={0}
            flagship={"flagship" in option ? option.flagship : false}
          />
        ))}
      </div>
    </Container>
  );
}
