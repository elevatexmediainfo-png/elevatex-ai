import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";
import { CONFIG_REGISTRY, getAllConfig, setConfig, type ConfigKey } from "@/lib/admin/config";

const patchSchema = z.object({
  key: z.enum(Object.keys(CONFIG_REGISTRY) as [ConfigKey, ...ConfigKey[]]),
  value: z.unknown(),
});

// GET /api/admin/config — every admin-editable system rule (providers,
// download rules, credit rules), with the label/description/category
// metadata the panel renders from. PATCH writes one key at a time, validated
// against that key's own Zod schema in the registry — an admin can never
// persist a value the rest of the app wouldn't accept.
export async function GET() {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  return apiSuccess({ config: await getAllConfig() });
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", "Invalid key/value.", 400, { issues: parsed.error.issues });
  }

  const def = CONFIG_REGISTRY[parsed.data.key];
  const valueParsed = def.schema.safeParse(parsed.data.value);
  if (!valueParsed.success) {
    return apiError("ERR_VALIDATION", `Invalid value for ${parsed.data.key}.`, 400, {
      issues: valueParsed.error.issues,
    });
  }

  await setConfig(parsed.data.key, valueParsed.data, session.user.id);
  return apiSuccess({ config: await getAllConfig() });
}
