import { requireAdminSession }   from "@/lib/admin/guard";
import { apiError, apiSuccess }  from "@/lib/api-response";
import { analyzeUserRequest }     from "@/lib/ai-os/user-understanding";
import { buildCreativeContext }   from "@/lib/ai-os/creative-context";
import { buildCreativeStrategy }  from "@/lib/ai-os/creative-brain";
import { buildCampaignPlan }      from "@/lib/ai-os/creative-director";
import { buildVisualLayoutPlan }  from "@/lib/ai-os/visual-layout";
import { buildTypographyPlan }    from "@/lib/ai-os/typography";
import { assembleBlueprint }      from "@/lib/ai-os/blueprint/engine";
import { planFromStrategy }       from "@/lib/ai-os/commercial-assets";
import { buildCompositionFromBlueprintInputs } from "@/lib/ai-os/commercial-composition";
import { buildCopyFromBlueprintInputs }        from "@/lib/ai-os/copy-intelligence";
import { buildTypographyFromBlueprintInputs }  from "@/lib/ai-os/typography-intelligence";
import type { CreativeRequest } from "@/lib/ai-os/types";
import { z } from "zod";

const bodySchema = z.object({
  idea: z.string().min(3).max(2000),
});

// POST /api/admin/creative-brain-inspector
// Runs the FULL deterministic pipeline — NO GPT, NO OpenAI cost.
// Returns every module's output + per-module timing for debugging.
export async function POST(req: Request) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("ERR_BAD_REQUEST", "Invalid JSON body.", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", parsed.error.message, 400);
  }

  const { idea } = parsed.data;
  const wallStart = performance.now();

  // ── Build the request ─────────────────────────────────────────────────────
  const request: CreativeRequest = {
    userId:      "admin-debug",
    rawIdea:     idea,
    requestedAt: new Date(),
  };

  // ── Stage 1: User Understanding ───────────────────────────────────────────
  let t = performance.now();
  const userUnderstanding = analyzeUserRequest(request);
  const t_uu = performance.now() - t;

  const context = buildCreativeContext(request, userUnderstanding, {}, { userId: "admin-debug" });

  // ── Stage 2: Creative Brain (strategy) ───────────────────────────────────
  t = performance.now();
  const strategy = buildCreativeStrategy(context);
  const t_strategy = performance.now() - t;

  // ── Stage 3: Campaign Plan (deterministic Creative Director) ──────────────
  t = performance.now();
  const campaignPlan = buildCampaignPlan(strategy);
  const t_campaign = performance.now() - t;

  // ── Stage 4: Visual Layout Plan ───────────────────────────────────────────
  t = performance.now();
  const layoutPlan = buildVisualLayoutPlan(strategy, campaignPlan);
  const t_layout = performance.now() - t;

  // ── Stage 5: Typography Plan (legacy) ────────────────────────────────────
  t = performance.now();
  const typographyPlan = buildTypographyPlan(strategy, campaignPlan, layoutPlan);
  const t_typoPlan = performance.now() - t;

  // ── Stage 6: Asset Plan ───────────────────────────────────────────────────
  t = performance.now();
  const assetPlan = planFromStrategy(strategy);
  const t_assets = performance.now() - t;

  // ── Stage 7: Composition Plan ─────────────────────────────────────────────
  t = performance.now();
  const composition = buildCompositionFromBlueprintInputs(strategy, assetPlan, layoutPlan);
  const t_comp = performance.now() - t;

  // ── Stage 8: Copy ─────────────────────────────────────────────────────────
  t = performance.now();
  const copy = buildCopyFromBlueprintInputs(strategy, assetPlan, idea);
  const t_copy = performance.now() - t;

  // ── Stage 9: Commercial Typography ───────────────────────────────────────
  t = performance.now();
  const typography = buildTypographyFromBlueprintInputs(strategy, copy, composition, layoutPlan);
  const t_typography = performance.now() - t;

  // ── Stage 10: Blueprint ───────────────────────────────────────────────────
  t = performance.now();
  const blueprint = assembleBlueprint({
    context,
    strategy,
    campaignPlan,
    layoutPlan,
    typographyPlan,
  });
  const t_blueprint = performance.now() - t;

  const totalMs = performance.now() - wallStart;

  return apiSuccess({
    rawIdea: idea,
    userUnderstanding,
    strategy,
    campaignPlan,
    layoutPlan,
    assetPlan,
    composition,
    copy,
    typography,
    blueprint,
    timing: {
      userUnderstanding: Math.round(t_uu * 100) / 100,
      strategy:          Math.round(t_strategy * 100) / 100,
      campaignPlan:      Math.round(t_campaign * 100) / 100,
      layoutPlan:        Math.round(t_layout * 100) / 100,
      typographyPlan:    Math.round(t_typoPlan * 100) / 100,
      assetPlan:         Math.round(t_assets * 100) / 100,
      composition:       Math.round(t_comp * 100) / 100,
      copy:              Math.round(t_copy * 100) / 100,
      typography:        Math.round(t_typography * 100) / 100,
      blueprint:         Math.round(t_blueprint * 100) / 100,
      total:             Math.round(totalMs * 100) / 100,
    },
  });
}
