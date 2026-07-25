import {
  Clapperboard,
  Image as ImageIcon,
  Share2,
  Mic,
  Megaphone,
  Building2,
  Film,
  PlaySquare,
  PartyPopper,
  Tag,
  UtensilsCrossed,
  Home,
  FileText,
  Palette,
  UserCircle,
  Music,
  Globe,
  Smartphone,
  AudioLines,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

// CreativeTool.icon is an admin-editable Lucide icon name (string), not raw
// SVG markup — this is the lookup map that resolves it client-side. Falls
// back to Sparkles for any name an admin enters that isn't in this list yet,
// rather than rendering nothing.
const ICON_MAP: Record<string, LucideIcon> = {
  Clapperboard,
  Image: ImageIcon,
  Share2,
  Mic,
  Megaphone,
  Building2,
  Film,
  PlaySquare,
  PartyPopper,
  Tag,
  UtensilsCrossed,
  Home,
  FileText,
  Palette,
  UserCircle,
  Music,
  Globe,
  Smartphone,
  AudioLines,
  Sparkles,
};

export function ToolIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? Sparkles;
  return <Icon className={className} />;
}
