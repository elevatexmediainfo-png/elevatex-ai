import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  billingModel: z.enum(["PAY_PER_DOWNLOAD", "SUBSCRIPTION"]),
  priceInPaise: z.number().int().min(0),
  billingInterval: z.enum(["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"]).nullable().optional(),
  trialDays: z.number().int().min(0).default(0),
  monthlyCredits: z.number().int().min(0).default(0),
  maxDownloadsPerMonth: z.number().int().min(1).nullable().optional(),
  providerPlanRef: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const plans = await prisma.pricingPlan.findMany({ orderBy: { sortOrder: "asc" } });
  return apiSuccess({ plans });
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", "Invalid plan.", 400, { issues: parsed.error.issues });
  }

  const plan = await prisma.pricingPlan.create({ data: parsed.data });
  return apiSuccess({ plan }, 201);
}
