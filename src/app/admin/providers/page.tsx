import { redirect } from "next/navigation";

// Milestone 10 — this page's old job (editing PROVIDER_*_PRIORITY/
// PROVIDER_STORAGE/PROVIDER_PAYMENT via the generic AdminConfigForm) is
// superseded by /admin/ai-providers, which edits the same priority/active-
// driver concept through the new encrypted ProviderConfig table instead.
// Redirecting (not deleting the route) keeps any existing bookmark/link
// working.
export default function AdminProvidersPage() {
  redirect("/admin/ai-providers");
}
