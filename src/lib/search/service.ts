import { prisma } from "@/lib/prisma";

// Milestone 14 — a real, simple substring search across the signed-in
// user's own content, backing the Dashboard's search bar. Deliberately NOT
// "AI search": there is no semantic/embedding search infrastructure in this
// codebase, and building one is out of scope for this milestone (user-
// confirmed: real simple search, honestly labeled).

export type SearchResultKind = "VIDEO_PROJECT" | "CREATIVE_PROJECT" | "TEMPLATE";

export interface SearchResult {
  kind: SearchResultKind;
  id: string;
  title: string;
  href: string;
}

export async function searchUserContent(userId: string, query: string, limit = 8): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const [videoProjects, creativeProjects, templates] = await Promise.all([
    prisma.videoProject.findMany({
      where: { userId, title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
    prisma.creativeProject.findMany({
      where: { userId, title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true, kind: true },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
    prisma.template.findMany({
      where: { name: { contains: q, mode: "insensitive" }, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: limit,
    }),
  ]);

  const results: SearchResult[] = [
    ...videoProjects.map((p) => ({ kind: "VIDEO_PROJECT" as const, id: p.id, title: p.title, href: `/videos/${p.id}` })),
    ...creativeProjects.map((p) => ({
      kind: "CREATIVE_PROJECT" as const,
      id: p.id,
      title: p.title,
      href: p.kind === "AI_IMAGE" ? `/images?projectId=${p.id}` : `/marketing-creatives?projectId=${p.id}`,
    })),
    ...templates.map((t) => ({ kind: "TEMPLATE" as const, id: t.id, title: t.name, href: `/templates?templateId=${t.id}` })),
  ];

  return results.slice(0, limit);
}
