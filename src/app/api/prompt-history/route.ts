import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { listPromptHistory } from "@/lib/prompts/service";

const PROMPT_KINDS = ["SCRIPT", "IMAGE", "VIDEO", "NEGATIVE"] as const;

// GET /api/prompt-history?kind=SCRIPT|IMAGE|VIDEO|NEGATIVE — Prompt Studio's
// "prompt history" panel.
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const kindParam = req.nextUrl.searchParams.get("kind");
  const kind = (PROMPT_KINDS as readonly string[]).includes(kindParam ?? "")
    ? (kindParam as (typeof PROMPT_KINDS)[number])
    : undefined;
  if (kindParam && !kind) {
    return apiError("ERR_VALIDATION", "kind must be one of SCRIPT, IMAGE, VIDEO, NEGATIVE.", 400);
  }

  const history = await listPromptHistory(session.user.id, kind);
  return apiSuccess({ history });
}
