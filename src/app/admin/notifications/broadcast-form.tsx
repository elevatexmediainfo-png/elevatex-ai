"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BroadcastForm() {
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [link, setLink] = React.useState("");
  const [email, setEmail] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  async function send() {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), link: link.trim() || undefined, email }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't send broadcast.");
        return;
      }
      toast.success(`Notified ${json.data.notifiedCount} users.`);
      setTitle("");
      setBody("");
      setLink("");
      setEmail(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-col gap-3">
        <div>
          <Label htmlFor="broadcast-title">Title</Label>
          <Input id="broadcast-title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 h-10" />
        </div>
        <div>
          <Label htmlFor="broadcast-body">Message</Label>
          <textarea
            id="broadcast-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-body-sm"
          />
        </div>
        <div>
          <Label htmlFor="broadcast-link">Link (optional)</Label>
          <Input id="broadcast-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/pricing" className="mt-1 h-10" />
        </div>
        <label className="flex items-center gap-2 text-body-sm text-neutral-700">
          <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
          Also send via email
        </label>
        <Button type="button" variant="primary" size="sm" disabled={sending || !title.trim() || !body.trim()} onClick={send}>
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Send to all users
        </Button>
      </div>
    </div>
  );
}
