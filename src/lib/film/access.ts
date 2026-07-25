import { prisma } from "@/lib/prisma";

// Shared ownership+kind guard for every AI Film sub-route (characters,
// sheet, storyboard, scenes, merge) — a VideoProject that either isn't
// owned by the caller or isn't sourceType FILM should 404 the same way in
// all of them, so this is one function instead of the same 3-line query
// re-typed at every route.
export async function requireOwnedFilmProject(userId: string, videoProjectId: string) {
  const project = await prisma.videoProject.findFirst({
    where: { id: videoProjectId, userId, sourceType: "FILM" },
  });
  return project;
}

// resolveFilmCharacterReferenceAssetId() lives in ./types.ts, not here —
// it's a pure function the Character Sheet screen (a Client Component)
// also needs, and this module pulls in `prisma`, which can't be imported
// into client code.
export { resolveFilmCharacterReferenceAssetId } from "./types";
