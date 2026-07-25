import {
  AudioLines,
  Award,
  Bookmark,
  CaseSensitive,
  Clapperboard,
  Clock,
  FolderOpen,
  Heart,
  Image,
  LayoutTemplate,
  Music,
  Palette,
  Search,
  Shapes,
  Shuffle,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Sticker,
  Type,
  Upload,
} from "lucide-react";

import type { SidebarSectionDef } from "./types";
import { GenericListSection } from "./sections/generic-list-section";
import { LibraryGridSection } from "./sections/library-grid-section";
import { StockSearchGridSection } from "./sections/stock-search-grid-section";
import { StockSearchListSection } from "./sections/stock-search-list-section";
import { IconsSection } from "./sections/icons-section";
import { FavoritesSection } from "./sections/favorites-section";
import { CollectionsSection } from "./sections/collections-section";
import { RecentSection } from "./sections/recent-section";
import { FontsSection } from "./sections/fonts-section";
import { UploadsSection } from "./sections/uploads-section";
import { BrandKitSection } from "./sections/brand-kit-section";
import { ProjectsSection } from "./sections/projects-section";
import { SearchSection } from "./sections/search-section";
import { FiltersSection } from "./sections/filters-section";

// The single source of truth for the Creative Studio Sidebar. The rail and
// the panel switcher both just map over this array — adding, removing, or
// reordering a section is a change here only, never to rail.tsx or index.tsx.
export const SIDEBAR_SECTIONS: SidebarSectionDef[] = [
  {
    id: "uploads",
    label: "Uploads",
    icon: Upload,
    group: "add",
    Component: UploadsSection,
  },
  {
    id: "stock-videos",
    label: "Stock Videos",
    icon: Clapperboard,
    group: "stock",
    Component: () => <StockSearchGridSection category="STOCK_MEDIA" type="video" title="Stock Videos" emptyIcon={Clapperboard} />,
  },
  {
    id: "stock-images",
    label: "Stock Images",
    icon: Image,
    group: "stock",
    Component: () => <StockSearchGridSection category="STOCK_MEDIA" type="image" title="Stock Images" emptyIcon={Image} />,
  },
  {
    id: "stock-music",
    label: "Stock Music",
    icon: Music,
    group: "stock",
    Component: () => <StockSearchListSection category="STOCK_MEDIA" type="audio" title="Stock Music" emptyIcon={Music} />,
  },
  {
    id: "sound-effects",
    label: "Sound Effects",
    icon: AudioLines,
    group: "stock",
    Component: () => <StockSearchListSection category="STOCK_MEDIA" type="audio" title="Sound Effects" emptyIcon={AudioLines} />,
  },
  {
    id: "fonts",
    label: "Fonts",
    icon: CaseSensitive,
    group: "design",
    Component: FontsSection,
  },
  {
    id: "text",
    label: "Text",
    icon: Type,
    group: "design",
    Component: () => (
      <GenericListSection
        sectionId="text"
        title="Text"
        emptyIcon={Type}
        emptyTitle="No text styles found"
        emptyDescription="Try a different search term."
      />
    ),
  },
  {
    id: "templates",
    label: "Templates",
    icon: LayoutTemplate,
    group: "design",
    Component: () => (
      <LibraryGridSection
        category="TEMPLATE"
        title="Templates"
        emptyIcon={LayoutTemplate}
        emptyTitle="No templates yet"
        emptyDescription="Curated templates uploaded via the Admin Asset Library will appear here."
      />
    ),
  },
  {
    id: "transitions",
    label: "Transitions",
    icon: Shuffle,
    group: "design",
    Component: () => (
      <LibraryGridSection
        category="TRANSITION"
        title="Transitions"
        emptyIcon={Shuffle}
        emptyTitle="No transitions yet"
        emptyDescription="Curated transitions uploaded via the Admin Asset Library will appear here."
      />
    ),
  },
  {
    id: "effects",
    label: "Effects",
    icon: Sparkles,
    group: "design",
    Component: () => (
      <LibraryGridSection
        category="EFFECT"
        title="Effects"
        emptyIcon={Sparkles}
        emptyTitle="No effects yet"
        emptyDescription="Curated effects uploaded via the Admin Asset Library will appear here."
      />
    ),
  },
  {
    id: "shapes",
    label: "Shapes",
    icon: Shapes,
    group: "design",
    Component: () => (
      <LibraryGridSection
        category="SHAPE"
        title="Shapes"
        emptyIcon={Shapes}
        emptyTitle="No shapes yet"
        emptyDescription="Curated shapes uploaded via the Admin Asset Library will appear here."
      />
    ),
  },
  {
    id: "icons",
    label: "Icons",
    icon: Smile,
    group: "design",
    Component: IconsSection,
  },
  {
    id: "stickers",
    label: "Stickers",
    icon: Sticker,
    group: "design",
    Component: () => (
      <LibraryGridSection
        category="STICKER"
        title="Stickers"
        emptyIcon={Sticker}
        emptyTitle="No stickers yet"
        emptyDescription="Curated stickers uploaded via the Admin Asset Library will appear here."
      />
    ),
  },
  {
    id: "logos",
    label: "Logos",
    icon: Award,
    group: "design",
    Component: () => (
      <LibraryGridSection
        category="LOGO"
        title="Logos"
        emptyIcon={Award}
        emptyTitle="No logos yet"
        emptyDescription="Curated logos uploaded via the Admin Asset Library will appear here."
      />
    ),
  },
  {
    id: "brand-kit",
    label: "Brand Kit",
    icon: Palette,
    group: "workspace",
    Component: BrandKitSection,
  },
  {
    id: "projects",
    label: "Projects",
    icon: FolderOpen,
    group: "workspace",
    Component: ProjectsSection,
  },
  {
    id: "favorites",
    label: "Favorites",
    icon: Heart,
    group: "workspace",
    Component: FavoritesSection,
  },
  {
    id: "collections",
    label: "Collections",
    icon: Bookmark,
    group: "workspace",
    Component: CollectionsSection,
  },
  {
    id: "recent",
    label: "Recent",
    icon: Clock,
    group: "workspace",
    Component: RecentSection,
  },
  {
    id: "search",
    label: "Search",
    icon: Search,
    group: "tools",
    Component: SearchSection,
  },
  {
    id: "filters",
    label: "Filters",
    icon: SlidersHorizontal,
    group: "tools",
    Component: FiltersSection,
  },
];

export const SIDEBAR_SECTION_BY_ID = new Map(SIDEBAR_SECTIONS.map((section) => [section.id, section]));
