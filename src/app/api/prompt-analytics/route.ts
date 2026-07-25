import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getPromptAnalytics } from "@/lib/prompts/service";

const DEFAULT_WINDOW_HOURS = 24 * 30;

// GET /api/prompt-analytics?hours=720 — Prompt Studio's analytics panel:
// per-kind prompt counts/avg length over a window, for the signed-in user.
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const hoursParam = Number(req.nextUrl.searchParams.get("hours"));
  const hours = Number.isFinite(hoursParam) && hoursParam > 0 ? hoursParam : DEFAULT_WINDOW_HOURS;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const analytics = await getPromptAnalytics(session.user.id, since);
  return apiSuccess({ analytics, windowHours: hours });
}
