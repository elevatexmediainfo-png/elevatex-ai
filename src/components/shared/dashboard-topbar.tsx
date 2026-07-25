"use client";

import * as React from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Zap,
  ChevronDown,
  LogOut,
  Settings,
  CreditCard,
  User,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "U";
}

function CreditsIndicator() {
  const [balance, setBalance] = React.useState<number | null>(null);

  React.useEffect(() => {
    fetch("/api/credits")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && typeof json.data?.balance === "number") {
          setBalance(json.data.balance);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <Link
      href="/credits"
      className={cn(
        "hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-150",
        "bg-dash-ink/[0.05] border border-dash-ink/[0.08]",
        "hover:bg-dash-ink/[0.09] hover:border-dash-ink/[0.15]",
      )}
    >
      <Zap className="size-3.5 text-violet-500 flex-shrink-0" />
      <span className="text-[13px] font-medium text-dash-ink/75 leading-none">
        {balance !== null ? `${balance.toLocaleString()} credits` : "Credits"}
      </span>
    </Link>
  );
}

function ProfileDropdown() {
  const { data: session } = useSession();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const initials = getInitials(session?.user?.name, session?.user?.email);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg hover:bg-dash-ink/[0.06] transition-colors duration-150 group"
        aria-label="User menu"
      >
        {/* Avatar */}
        {session?.user?.image ? (
          <img
            src={session.user.image}
            alt={session.user.name ?? "User"}
            className="size-7 rounded-full object-cover ring-1 ring-dash-ink/10"
          />
        ) : (
          <div
            className="flex size-7 items-center justify-center rounded-full text-white text-[11px] font-bold flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)",
            }}
          >
            {initials}
          </div>
        )}

        <ChevronDown
          className={cn(
            "size-3.5 text-dash-ink/35 transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.14, ease: [0, 0, 0.2, 1] }}
            className="absolute right-0 top-full mt-2 w-56 z-50 overflow-hidden rounded-xl border border-dash-ink/[0.08] bg-dash-surface-2/96 shadow-2xl backdrop-blur-xl"
          >
            {/* User info header */}
            <div className="px-4 py-3 border-b border-dash-ink/[0.06]">
              <div className="flex items-center gap-2.5">
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt=""
                    className="size-8 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="flex size-8 items-center justify-center rounded-full text-white text-[11px] font-bold flex-shrink-0"
                    style={{
                      background:
                        "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)",
                    }}
                  >
                    {initials}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-dash-ink truncate leading-tight">
                    {session?.user?.name ?? "User"}
                  </p>
                  <p className="text-[11.5px] text-dash-ink/40 truncate mt-0.5">
                    {session?.user?.email ?? ""}
                  </p>
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div className="py-1.5 px-1">
              <Link
                href="/credits"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-dash-ink/65 hover:text-dash-ink hover:bg-dash-ink/[0.06] transition-colors duration-100"
              >
                <CreditCard className="size-4 flex-shrink-0" />
                Credits &amp; Billing
              </Link>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-dash-ink/65 hover:text-dash-ink hover:bg-dash-ink/[0.06] transition-colors duration-100"
              >
                <Settings className="size-4 flex-shrink-0" />
                Settings
              </Link>
            </div>

            <div className="border-t border-dash-ink/[0.06] py-1.5 px-1">
              <button
                type="button"
                onClick={() => signOut({ redirectTo: "/" })}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-dash-ink/55 hover:text-red-400 hover:bg-red-500/[0.08] transition-colors duration-100"
              >
                <LogOut className="size-4 flex-shrink-0" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DashboardTopbar() {
  return (
    <header className="relative z-20 flex-shrink-0 h-[60px] border-b border-edge-subtle bg-glass-panel backdrop-blur-xl lv-topbar">
      <div className="h-full flex items-center justify-between px-5 gap-4">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 flex-shrink-0 group"
        >
          <div
            className="flex size-8 items-center justify-center rounded-lg flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)",
              boxShadow: "0 4px 14px rgba(124,58,237,0.35)",
            }}
          >
            <Sparkles className="size-[15px] text-white" />
          </div>
          <span className="text-[15px] font-semibold text-dash-ink tracking-[-0.2px] leading-none">
            Elevatex{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #A78BFA 0%, #60A5FA 100%)",
              }}
            >
              AI
            </span>
          </span>
        </Link>

        {/* Right cluster */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Credits indicator */}
          <CreditsIndicator />

          {/* Light/dark switch */}
          <ThemeToggle />

          {/* Upgrade Plan CTA */}
          <Link
            href="/credits"
            className="hidden sm:flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-semibold text-white transition-all duration-150 flex-shrink-0"
            style={{
              background:
                "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)",
              boxShadow: "0 2px 14px rgba(124,58,237,0.30)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow =
                "0 4px 20px rgba(124,58,237,0.45)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow =
                "0 2px 14px rgba(124,58,237,0.30)";
            }}
          >
            <Zap className="size-3.5" />
            Upgrade Plan
          </Link>

          {/* Notifications */}
          <NotificationBell />

          {/* User profile */}
          <ProfileDropdown />
        </div>
      </div>
    </header>
  );
}
