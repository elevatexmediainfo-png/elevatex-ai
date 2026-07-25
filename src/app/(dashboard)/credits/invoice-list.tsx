"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

interface InvoiceRow {
  id: string;
  invoiceNumber: number;
  totalPaise: number;
  createdAt: string;
}

function rupees(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`;
}

export function InvoiceList({ invoices }: { invoices: InvoiceRow[] }) {
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  async function download(id: string) {
    setDownloadingId(id);
    try {
      const res = await fetch(`/api/billing/invoices/${id}/pdf`);
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't generate invoice.");
        return;
      }
      window.open(json.data.url, "_blank");
    } finally {
      setDownloadingId(null);
    }
  }

  if (invoices.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-label-lg text-dash-ink">Invoices</h2>
      {invoices.map((inv) => (
        <div
          key={inv.id}
          className="flex items-center justify-between gap-4 rounded-lg border border-edge-card bg-glass-card px-4 py-3"
        >
          <div>
            <p className="text-label-md text-dash-ink">Invoice #{inv.invoiceNumber}</p>
            <p className="text-body-sm text-dash-ink/55">
              {formatDate(new Date(inv.createdAt))} · {rupees(inv.totalPaise)}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => download(inv.id)} disabled={downloadingId === inv.id}>
            {downloadingId === inv.id ? <Loader2 className="size-4 animate-spin" /> : "Download PDF"}
          </Button>
        </div>
      ))}
    </div>
  );
}
