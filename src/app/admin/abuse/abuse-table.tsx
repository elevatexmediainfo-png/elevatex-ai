"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AbuseFlag {
  userId: string;
  label: string;
  reason: "EXCESSIVE_RATE_LIMIT_HITS" | "FAST_CREDIT_BURN";
  detail: string;
}

const REASON_LABEL: Record<AbuseFlag["reason"], string> = {
  EXCESSIVE_RATE_LIMIT_HITS: "Excessive rate-limit hits",
  FAST_CREDIT_BURN: "Fast AI-credit burn",
};

export function AbuseTable() {
  const [flags, setFlags] = React.useState<AbuseFlag[] | null>(null);
  const [actingId, setActingId] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    fetch("/api/admin/abuse")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setFlags(json.data.flags);
      });
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function suspend(userId: string) {
    setActingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/suspend`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't suspend this account.");
        return;
      }
      toast.success("Account suspended.");
      load();
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full text-left text-body-sm">
        <thead className="border-b border-neutral-200 text-label-sm text-neutral-500">
          <tr>
            <th className="px-4 py-2">User</th>
            <th className="px-4 py-2">Reason</th>
            <th className="px-4 py-2">Detail</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {!flags || flags.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                {flags === null ? "Loading…" : "No flagged accounts."}
              </td>
            </tr>
          ) : (
            flags.map((f) => (
              <tr key={`${f.userId}-${f.reason}`} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2 font-medium text-neutral-900">{f.label}</td>
                <td className="px-4 py-2">
                  <Badge variant="warning" outline>
                    {REASON_LABEL[f.reason]}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-neutral-500">{f.detail}</td>
                <td className="px-4 py-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => suspend(f.userId)} disabled={actingId === f.userId}>
                    {actingId === f.userId ? <Loader2 className="size-4 animate-spin" /> : "Suspend"}
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
