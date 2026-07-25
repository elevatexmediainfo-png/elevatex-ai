import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { InvalidStateError } from "./errors";

// Folder tree for the Cloud Video Editor's Project Browser (Milestone 24).
// Self-referencing, one level of nesting is as reasonable as many — no
// depth cap needed since createFolder/updateFolder validate the parent
// belongs to the same user and updateFolder additionally rejects cycles.

type Db = Prisma.TransactionClient | typeof prisma;

export async function listFolders(userId: string, db: Db = prisma) {
  return db.editorFolder.findMany({ where: { userId }, orderBy: { name: "asc" } });
}

export async function createFolder(userId: string, input: { name: string; parentId?: string }, db: Db = prisma) {
  if (input.parentId) {
    const parent = await db.editorFolder.findFirst({ where: { id: input.parentId, userId } });
    if (!parent) throw new InvalidStateError("Parent folder not found.");
  }
  return db.editorFolder.create({ data: { userId, name: input.name, parentId: input.parentId } });
}

// Walks up from `candidateAncestorId` to the tree root — true if `folderId`
// is encountered along the way, meaning moving `folderId` under
// `candidateAncestorId` would detach it (and everything under it) from the
// tree by making a folder its own ancestor.
async function isDescendant(db: Db, folderId: string, candidateAncestorId: string): Promise<boolean> {
  let current = await db.editorFolder.findUnique({ where: { id: candidateAncestorId }, select: { parentId: true } });
  while (current?.parentId) {
    if (current.parentId === folderId) return true;
    current = await db.editorFolder.findUnique({ where: { id: current.parentId }, select: { parentId: true } });
  }
  return false;
}

export async function updateFolder(
  userId: string,
  folderId: string,
  patch: { name?: string; parentId?: string | null },
  db: Db = prisma
) {
  const folder = await db.editorFolder.findFirst({ where: { id: folderId, userId } });
  if (!folder) throw new InvalidStateError("Folder not found.");

  if (patch.parentId) {
    if (patch.parentId === folderId) throw new InvalidStateError("A folder cannot be its own parent.");
    const parent = await db.editorFolder.findFirst({ where: { id: patch.parentId, userId } });
    if (!parent) throw new InvalidStateError("Parent folder not found.");
    if (await isDescendant(db, folderId, patch.parentId)) {
      throw new InvalidStateError("Cannot move a folder into its own subfolder.");
    }
  }

  return db.editorFolder.update({ where: { id: folderId }, data: patch });
}

// Cascades to child folders (schema onDelete: Cascade); projects inside are
// orphaned to root, not deleted (EditorProject.folder is onDelete: SetNull)
// — deleting a folder is an organizational action, never a data-loss one.
export async function deleteFolder(userId: string, folderId: string, db: Db = prisma): Promise<void> {
  const claim = await db.editorFolder.deleteMany({ where: { id: folderId, userId } });
  if (claim.count === 0) throw new InvalidStateError("Folder not found.");
}
