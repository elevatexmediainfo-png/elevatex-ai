"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

// Polls rather than streams (SSE/WS) — notifications are advisory, not
// latency-sensitive, and every other near-real-time surface in this app
// (queue progress) already uses its own dedicated SSE stream where it
// actually matters. A 30s poll is plenty for "you have a new notification."
const POLL_INTERVAL_MS = 30_000;

export function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(() => {
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setNotifications(json.data.notifications);
          setUnreadCount(json.data.unreadCount);
        }
      });
  }, []);

  React.useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleOpen() {
    setOpen((v) => !v);
    if (unreadCount > 0) {
      await fetch("/api/notifications/read-all", { method: "POST" });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="relative flex size-9 items-center justify-center rounded-lg text-dash-ink/60 hover:bg-dash-ink/5 hover:text-dash-ink"
        aria-label="Notifications"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex size-2 items-center justify-center rounded-full bg-accent-orange" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-dash-ink/10 bg-dash-surface-2/95 shadow-2xl backdrop-blur-xl">
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-body-sm text-dash-ink/50">No notifications yet.</p>
            ) : (
              notifications.map((n) => {
                const content = (
                  <div className={cn("border-b border-dash-ink/10 px-4 py-3 last:border-0", !n.readAt && "bg-dash-ink/5")}>
                    <p className="text-label-md text-dash-ink">{n.title}</p>
                    <p className="mt-0.5 text-body-sm text-dash-ink/55">{n.body}</p>
                    <p className="mt-1 text-label-sm text-dash-ink/35">{formatDateTime(new Date(n.createdAt))}</p>
                  </div>
                );
                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => setOpen(false)} className="block hover:bg-dash-ink/5">
                    {content}
                  </Link>
                ) : (
                  <div key={n.id}>{content}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
