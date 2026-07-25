import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";

const createSchema = z.object({
  name: z.string().min(1),
  creditAmount: z.number().int().min(1),
  priceInPaise: z.number().int().min(0),
  sortOrder: z.number().int().default(0),
});

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const packages = await prisma.creditPackage.findMany({ orderBy: { sortOrder: "asc" } });
  return apiSuccess({ packages });
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", "Invalid credit package.", 400, { issues: parsed.error.issues });
  }

  const pkg = await prisma.creditPackage.create({ data: parsed.data });
  return apiSuccess({ pkg }, 201);
}
