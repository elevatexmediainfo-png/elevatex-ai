import { TemplateEditor } from "./template-editor";

// Dedicated editor page (2026-08-04) — "Add Template" on the list page
// navigates straight here. Thin server wrapper only; all fetching/saving
// is client-side, same convention as the rest of this admin surface (see
// template-editor.tsx).
export default async function MarketingTemplateEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TemplateEditor templateId={id} />;
}
