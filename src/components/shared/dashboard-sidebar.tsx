"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SIDEBAR_NAV_GROUPS, type NavItem } from "./dashboard-nav-items";

const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 256;

function useCollapsed() {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("elevatex-sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem("elevatex-sidebar-collapsed", String(next));
      return next;
    });
  }

  return { collapsed, toggle, mounted };
}

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const disabled = item.disabled ?? false;
  const sharedClassName = cn(
    "group relative flex items-center gap-3 rounded-lg transition-all duration-150 select-none",
    collapsed ? "h-10 w-10 justify-center" : "h-9 px-3",
    disabled
      ? "cursor-not-allowed text-dash-ink/25"
      : active
        ? "text-dash-ink"
        : "text-dash-ink/45 hover:text-dash-ink/85",
  );

  const content = (
    <>
      {/* Active background */}
      {active && !disabled && (
        <span
          className="absolute inset-0 rounded-lg"
          style={{
            background:
              "linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(37,99,235,0.12) 100%)",
          }}
        />
      )}

      {/* Hover background (non-active, non-disabled) */}
      {!active && !disabled && (
        <span className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-glass-soft" />
      )}

      {/* Active left accent bar */}
      {active && !disabled && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
          style={{
            background: "linear-gradient(180deg, #A78BFA 0%, #60A5FA 100%)",
          }}
        />
      )}

      {/* Icon */}
      <item.icon
        className={cn(
          "relative z-10 size-[18px] flex-shrink-0 transition-colors duration-150",
          disabled ? "text-dash-ink/25" : active ? "text-violet-500" : "text-dash-ink/45 group-hover:text-dash-ink/80",
        )}
      />

      {/* Label + badge — hidden when collapsed */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            key="label"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
            className="relative z-10 flex flex-1 items-center justify-between min-w-0"
          >
            <span
              className={cn(
                "text-[13.5px] font-medium leading-none truncate",
                disabled ? "text-dash-ink/35" : active ? "text-dash-ink" : "text-dash-ink/55 group-hover:text-dash-ink/85",
              )}
            >
              {item.label}
            </span>
            {item.badge && !disabled && (
              <span className="ml-2 flex-shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-500/25">
                {item.badge}
              </span>
            )}
            {disabled && (
              <span className="ml-2 flex-shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wide bg-dash-ink/5 text-dash-ink/30 border border-dash-ink/10">
                Soon
              </span>
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </>
  );

  // Disabled items never navigate — a real, honest placeholder (matching
  // the editor sidebar's own Captions-tab convention) rather than a link
  // that looks live but goes nowhere real.
  const link = disabled ? (
    <span className={sharedClassName} aria-disabled="true">
      {content}
    </span>
  ) : (
    <Link href={item.href} className={sharedClassName}>
      {content}
    </Link>
  );

  const tooltipText = disabled ? item.disabledReason : undefined;

  if (collapsed || disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>
          {tooltipText ? (
            <span>{tooltipText}</span>
          ) : (
            <span className="flex items-center gap-1.5">
              {item.label}
              {item.badge && (
                <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">{item.badge}</span>
              )}
            </span>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const { collapsed, toggle, mounted } = useCollapsed();

  // Prevent width flash before localStorage is read
  const width = mounted ? (collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH) : EXPANDED_WIDTH;

  return (
    <motion.aside
      animate={{ width }}
      initial={false}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "hidden sm:flex flex-col flex-shrink-0 h-full",
        "border-r border-edge-subtle bg-glass-panel backdrop-blur-xl overflow-hidden relative lv-sidebar",
      )}
    >
      {/* Subtle gradient accent at top */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(124,58,237,0.5) 50%, transparent 100%)",
        }}
      />

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-5 scrollbar-none">
        <div className="flex flex-col gap-6 px-2">
          {SIDEBAR_NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {/* Group label — hidden when collapsed */}
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.p
                    key="group-label"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className="px-3 mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-dash-ink/25 select-none"
                  >
                    {group.label}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Items */}
              <div className={cn("flex flex-col gap-0.5", collapsed && "items-center")}>
                {group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" &&
                      pathname?.startsWith(`${item.href.split("?")[0]}/`)) ||
                    (item.href !== "/dashboard" &&
                      pathname === item.href.split("?")[0]);
                  return (
                    <NavLink
                      key={item.href}
                      item={item}
                      active={active}
                      collapsed={collapsed}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* Divider */}
      <div className="mx-3 border-t border-edge-subtle" />

      {/* Collapse toggle */}
      <div className={cn("p-2", collapsed && "flex justify-center")}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggle}
              className={cn(
                "flex items-center gap-2.5 rounded-lg transition-colors duration-150",
                "text-dash-ink/30 hover:text-dash-ink/65 hover:bg-glass-soft",
                collapsed
                  ? "h-10 w-10 justify-center"
                  : "w-full px-3 h-9",
              )}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-[17px]" />
              ) : (
                <>
                  <PanelLeftClose className="size-[17px]" />
                  <span className="text-[13px] font-medium">Collapse</span>
                </>
              )}
            </button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right" sideOffset={12}>
              Expand sidebar
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </motion.aside>
  );
}
