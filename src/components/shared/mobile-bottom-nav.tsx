"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { DASHBOARD_NAV_ITEMS } from "./dashboard-nav-items";

// The sidebar in (dashboard)/layout.tsx is `hidden` below `sm` — without
// this, there was no way to navigate the dashboard at all on a phone, which
// is the primary device for this app's target users. Fixed to the bottom of
// the viewport, same nav items as the desktop sidebar (dashboard-nav-items.ts).
export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-dash-ink/10 bg-dash-surface-1/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      {DASHBOARD_NAV_ITEMS.filter((item) => item.mobile).map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-label-sm",
              active ? "text-dash-ink" : "text-dash-ink/45"
            )}
          >
            <item.icon className="size-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
