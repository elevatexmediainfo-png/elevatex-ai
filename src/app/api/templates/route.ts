import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";

// GET /api/templates?vertical=RESTAURANT — defaults to the signed-in user's
// own business vertical (from onboarding) when no query param is supplied.
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const requestedVertical = req.nextUrl.searchParams.get("vertical");

  let vertical = requestedVertical;
  if (!vertical) {
    const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
    vertical = profile?.businessVertical ?? null;
  }

  const templates = await prisma.template.findMany({
    where: {
      isActive: true,
      ...(vertical ? { vertical: vertical as never } : {}),
    },
    orderBy: { name: "asc" },
  });

  return apiSuccess({ templates });
}
