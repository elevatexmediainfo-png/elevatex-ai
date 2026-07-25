import {
  LayoutDashboard,
  Plus,
  FolderKanban,
  Scissors,
  ImageIcon,
  Clapperboard,
  Megaphone,
  LayoutTemplate,
  Layers,
  FolderOpen,
  Palette,
  Wallet,
  BarChart3,
  Settings,
  UserCircle,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  mobile: boolean;
  badge?: "NEW";
  // Honest placeholder (2026-07-22) — matches the editor sidebar's own
  // Captions-tab convention (disabled: true, disabledReason shown as a
  // tooltip) rather than a dead/working-looking link. No backend yet;
  // real HeyGen integration follows post-launch. A disabled item never
  // navigates (see NavLink in dashboard-sidebar.tsx).
  disabled?: boolean;
  disabledReason?: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

// Grouped structure for the premium sidebar (desktop).
// PRD Section: Sidebar — groups: Create / AI Tools / Business / Account.
export const SIDEBAR_NAV_GROUPS: NavGroup[] = [
  {
    label: "Create",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, mobile: true },
      { label: "Create", href: "/create", icon: Plus, mobile: true },
      { label: "Projects", href: "/projects", icon: FolderKanban, mobile: false },
    ],
  },
  {
    label: "AI Tools",
    items: [
      // B4 Phase 3 (2026-07-22) — "AI Studio" (/studio) and "Talking Head"
      // (/videos?type=talking_head) removed as separate top-level entries;
      // both drove the legacy VideoProject/Track/Clip model exclusively
      // (Milestone 9/11), which is being retired in favor of this editor's
      // EditorTrack/EditorClip model + AI Auto-Edit. Their one real job —
      // finding/resuming an existing legacy project — is preserved as a
      // "Legacy videos" tab inside "AI Video Editor" below (project-
      // browser.tsx), not dropped. New video creation always lands here now.
      { label: "Images", href: "/images", icon: ImageIcon, mobile: false },
      { label: "Videos", href: "/videos", icon: Clapperboard, mobile: false },
      { label: "AI Video Editor", href: "/editor", icon: Scissors, mobile: false, badge: "NEW" },
      {
        label: "AI Avatar Video",
        href: "#",
        icon: UserCircle,
        mobile: false,
        disabled: true,
        disabledReason: "Generate videos using your own cloned avatar — coming soon.",
      },
    ],
  },
  {
    label: "Business",
    items: [
      { label: "Marketing", href: "/marketing-creatives", icon: Megaphone, mobile: false },
      // Real navigation-gap fix (2026-07-25) — /marketing-templates (admin
      // reference-image + {{placeholder}} templates, with real per-generation
      // logo upload + multi-image conditioning) had ZERO persistent nav
      // entry point anywhere — only reachable via the dashboard homepage's
      // quick-action tile (quick-actions-grid.tsx), which itself was only
      // repointed here from /templates on 2026-07-24 for this exact reason.
      // Meanwhile 3 of 4 "Templates"-labeled links across the app (this item,
      // the homepage TemplatesSection, and the prompt empty-state CTA) still
      // pointed at the OLDER, unrelated /templates gallery (pre-built AI
      // VIDEO templates by vertical, Template model, no logo upload at all)
      // — a founder report of "the template form has no logo upload" traced
      // directly to landing on THIS old gallery via the sidebar, not a
      // missing field. Relabeled "Templates" -> "Video Templates" (href
      // unchanged, still a real, separate, working feature) and added this
      // new item so Marketing Templates has its own persistent, correctly
      // routed sidebar entry.
      { label: "Video Templates", href: "/templates", icon: LayoutTemplate, mobile: false },
      { label: "Marketing Templates", href: "/marketing-templates", icon: Layers, mobile: false },
      { label: "Brand Kit", href: "/brand-kit", icon: Palette, mobile: false },
      { label: "Assets", href: "/media-library", icon: FolderOpen, mobile: false },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Credits", href: "/credits", icon: Wallet, mobile: true },
      { label: "Usage", href: "/usage", icon: BarChart3, mobile: false },
      { label: "Settings", href: "/settings", icon: Settings, mobile: false },
    ],
  },
];

// Flat list derived from groups — used by MobileBottomNav (unchanged API).
// mobile: true items are the curated phone-tab subset.
export const DASHBOARD_NAV_ITEMS: NavItem[] = SIDEBAR_NAV_GROUPS.flatMap(
  (g) => g.items,
);
