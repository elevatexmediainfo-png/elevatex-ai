import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";

// Milestone 14 — CreativeTool is the single source of truth for every
// Dashboard card/quick action/coming-soon stub (lib/seed-defaults.ts seeds
// the launch set). This CRUD surface is the literal fulfillment of "admin
// configures dashboard cards/credit cost/enable-disable/default AI
// model/prompt templates/icons/order — no code change needed."
const createSchema = z.object({
  key: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(100),
  description: z.string().trim().max(300).nullable().optional(),
  icon: z.string().trim().min(1).max(60),
  gradientFrom: z.string().trim().max(20).nullable().optional(),
  gradientTo: z.string().trim().max(20).nullable().optional(),
  category: z.enum(["MAIN_CARD", "QUICK_ACTION", "COMING_SOON"]),
  pipeline: z.enum(["VIDEO", "IMAGE", "SOCIAL_MEDIA", "MARKETING_CREATIVE", "TALKING_HEAD", "BRAND_ASSET", "EXTERNAL"]),
  presetKey: z.string().trim().max(60).nullable().optional(),
  routeOverride: z.string().trim().max(200).nullable().optional(),
  creditCostEstimate: z.number().int().min(0).default(0),
  estimatedSeconds: z.number().int().min(0).default(0),
  promptTemplate: z.string().trim().max(2000).nullable().optional(),
  defaultProviderId: z.string().trim().max(60).nullable().optional(),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const tools = await prisma.creativeTool.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
  return apiSuccess({ tools });
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", "Invalid creative tool.", 400, { issues: parsed.error.issues });
  }

  const existing = await prisma.creativeTool.findUnique({ where: { key: parsed.data.key } });
  if (existing) {
    return apiError("ERR_VALIDATION", "A creative tool with this key already exists.", 400);
  }

  const tool = await prisma.creativeTool.create({ data: parsed.data });
  return apiSuccess({ tool }, 201);
}
