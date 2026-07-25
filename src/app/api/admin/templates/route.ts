import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";

const BUSINESS_VERTICALS = [
  "RESTAURANT",
  "CAFE_BAKERY",
  "SALON_SPA",
  "DENTAL_DIAGNOSTIC",
  "REAL_ESTATE",
  "RETAIL",
  "GYM_FITNESS",
  "HOSPITAL",
  "COACHING_EDTECH",
  "HOTEL",
  "FINANCE",
  "OTHER",
] as const;
const VIDEO_PLATFORMS = ["INSTAGRAM_REEL", "INSTAGRAM_POST", "FACEBOOK", "YOUTUBE_SHORTS", "WHATSAPP_STATUS", "GOOGLE_BUSINESS"] as const;
const ASPECT_RATIOS = ["RATIO_9_16", "RATIO_1_1", "RATIO_16_9"] as const;
const VIDEO_OBJECTIVES = ["PROMOTION", "NEW_LAUNCH", "FESTIVAL_GREETING", "TESTIMONIAL", "ANNOUNCEMENT", "OFFER_DISCOUNT", "BRAND_AWARENESS"] as const;

// Milestone 14 — closes the "no admin UI for Templates" gap and fulfills
// the Admin Panel's "Featured templates" requirement (isFeatured) and the
// Dashboard's "Festival" trending tile (defaultObjective).
const createSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(300).nullable().optional(),
  vertical: z.enum(BUSINESS_VERTICALS),
  platform: z.enum(VIDEO_PLATFORMS),
  aspectRatio: z.enum(ASPECT_RATIOS),
  durationSeconds: z.number().int().min(5).max(300).default(30),
  thumbnailUrl: z.string().trim().max(500).nullable().optional(),
  creditCost: z.number().int().min(0).default(1),
  includeVoiceover: z.boolean().default(false),
  promptTemplate: z.string().trim().min(1).max(4000),
  isFeatured: z.boolean().default(false),
  defaultObjective: z.enum(VIDEO_OBJECTIVES).nullable().optional(),
});

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const templates = await prisma.template.findMany({ orderBy: [{ isFeatured: "desc" }, { name: "asc" }] });
  return apiSuccess({ templates });
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", "Invalid template.", 400, { issues: parsed.error.issues });
  }

  const template = await prisma.template.create({ data: parsed.data });
  return apiSuccess({ template }, 201);
}
