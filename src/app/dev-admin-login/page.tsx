import { notFound } from "next/navigation";

import { DEV_LOGIN_BYPASS_ENABLED } from "@/lib/auth";
import { DevAdminLoginForm } from "./dev-admin-login-form";

// force-dynamic: see (marketing)/layout.tsx's comment — without it, Next
// bakes DEV_LOGIN_BYPASS_ENABLED's build-time value into a static artifact.
export const dynamic = "force-dynamic";

// Deliberately not linked from /login or any nav — this exists purely so a
// developer who already knows the URL can skip OTP rate limiting while
// testing the Admin Panel locally. Gated server-side here (not just by
// hiding the form client-side) with the exact same flag that decides
// whether lib/auth/index.ts registers the "dev-bypass" NextAuth provider at
// all — in production, or once a real SMS gateway is configured, this route
// 404s outright instead of rendering a dead form.
export default function DevAdminLoginPage() {
  if (!DEV_LOGIN_BYPASS_ENABLED) notFound();
  return <DevAdminLoginForm />;
}
