import { toast } from "sonner";

// Shared fetch wrapper for the Cloud Video Editor's TanStack Query hooks
// (Milestone 24) — same {success, data|error} envelope check the existing
// AI editor's editor-client.tsx `api()` helper already uses, just promoted
// out of a single component so every hook in this module can share it.
export async function editorApi<T>(url: string, method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) {
    const message = json.error?.message ?? "Something went wrong.";
    toast.error(message);
    throw new Error(message);
  }
  return json.data as T;
}
