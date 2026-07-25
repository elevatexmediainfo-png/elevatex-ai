"use client";

import { AdminConfigForm } from "@/components/admin/admin-config-form";

export function RulesForm() {
  return (
    <AdminConfigForm
      sections={[{ category: "download_rules", title: "Download rules" }]}
    />
  );
}
