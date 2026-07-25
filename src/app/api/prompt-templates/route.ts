import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createPromptTemplateSchema, PROMPT_TEMPLATE_CATEGORIES } from "@/lib/validations/video";
import { createPromptTemplate, listPromptTemplates } from "@/lib/prompts/service";

// GET /api/prompt-templates?category=SCRIPT|IMAGE|VIDEO — Prompt Studio's
// reusable saved prompts (user-owned only this milestone).
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const categoryParam = req.nextUrl.searchParams.get("category");
  const category = (PROMPT_TEMPLATE_CATEGORIES as readonly string[]).includes(categoryParam ?? "")
    ? (categoryParam as (typeof PROMPT_TEMPLATE_CATEGORIES)[number])
    : undefined;
  if (categoryParam && !category) {
    return apiError("ERR_VALIDATION", "category must be one of SCRIPT, IMAGE, VIDEO.", 400);
  }

  const templates = await listPromptTemplates(session.user.id, category);
  return apiSuccess({ templates });
}

// POST /api/prompt-templates — save a new reusable prompt template.
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const data = createPromptTemplateSchema.parse(body);

    const template = await createPromptTemplate({
      userId: session.user.id,
      category: data.category,
      title: data.title,
      promptText: data.promptText,
      negativePromptText: data.negativePromptText,
    });

    return apiSuccess({ template }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the template fields and try again.", 400, {
        issues: err.issues,
      });
    }
    console.error("POST /api/prompt-templates failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong saving that template.", 500);
  }
}
