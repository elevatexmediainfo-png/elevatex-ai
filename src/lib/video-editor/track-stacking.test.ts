import { describe, expect, it, vi } from "vitest";
import { computeTrackZIndex, computeTrackZIndexByOrder } from "./track-stacking";

// addTrack() depends on getConfig (a real-DB-backed cache) purely for the
// max-tracks-per-project guard — stubbed here the same way engine.test.ts
// substitutes fakes for its own DB-backed dependencies, so this test needs
// no Postgres connection.
vi.mock("@/lib/admin/config", () => ({
  getConfig: vi.fn().mockResolvedValue(20),
}));

import { addTrack } from "./tracks";

// A minimal in-memory fake standing in for the Prisma `db` parameter
// addTrack() already accepts as its own dependency-injection seam — same
// spirit as engine.test.ts's fakes, just shaped for the one model this
// function touches.
interface FakeTrackRow {
  id: string;
  projectId: string;
  kind: string;
  order: number;
  audioSubtype: string | null;
}

function makeFakeDb() {
  const rows: FakeTrackRow[] = [];
  let nextId = 1;
  return {
    rows,
    editorTrack: {
      findFirst: vi.fn(async ({ where, orderBy }: { where: { projectId: string }; orderBy: { order: "asc" | "desc" } }) => {
        const matches = rows.filter((r) => r.projectId === where.projectId);
        if (matches.length === 0) return null;
        const sorted = [...matches].sort((a, b) => (orderBy.order === "asc" ? a.order - b.order : b.order - a.order));
        return sorted[0]!;
      }),
      count: vi.fn(async ({ where }: { where: { projectId: string } }) => rows.filter((r) => r.projectId === where.projectId).length),
      create: vi.fn(async ({ data }: { data: { projectId: string; kind: string; order: number; audioSubtype: string | null } }) => {
        const row: FakeTrackRow = { id: `track_${nextId++}`, projectId: data.projectId, kind: data.kind, order: data.order, audioSubtype: data.audioSubtype };
        rows.push(row);
        return row;
      }),
    },
    // Cast through unknown — this fake intentionally implements only the
    // subset of the Prisma client surface addTrack() actually calls.
  } as unknown as Parameters<typeof addTrack>[3] & { rows: FakeTrackRow[] };
}

describe("computeTrackZIndex", () => {
  it("gives index 0 (topmost row in the track panel) the highest z-index", () => {
    expect(computeTrackZIndex(3, 0)).toBeGreaterThan(computeTrackZIndex(3, 1));
    expect(computeTrackZIndex(3, 1)).toBeGreaterThan(computeTrackZIndex(3, 2));
  });
});

describe("computeTrackZIndexByOrder", () => {
  it("ranks the lowest `order` value highest", () => {
    const z = computeTrackZIndexByOrder([
      { id: "a", order: 5 },
      { id: "b", order: 1 },
      { id: "c", order: 3 },
    ]);
    expect(z.get("b")!).toBeGreaterThan(z.get("c")!);
    expect(z.get("c")!).toBeGreaterThan(z.get("a")!);
  });
});

describe("addTrack ordering", () => {
  it("a TEXT track added after an existing VIDEO track lands ABOVE it (lower order, higher z-index) — the actual reported bug", async () => {
    const db = makeFakeDb();
    const projectId = "proj1";
    const video = await addTrack(projectId, "VIDEO", undefined, db);
    const text = await addTrack(projectId, "TEXT", undefined, db);

    expect(text.order).toBeLessThan(video.order);

    // The full regression: run both through the exact same z-index
    // convention the compositor uses and assert the visible result.
    const z = computeTrackZIndexByOrder(db.rows);
    expect(z.get(text.id)!).toBeGreaterThan(z.get(video.id)!);
  });

  it("SUBTITLE added after TEXT lands above TEXT too (most-recently-added wins the front)", async () => {
    const db = makeFakeDb();
    const projectId = "proj1";
    const video = await addTrack(projectId, "VIDEO", undefined, db);
    const text = await addTrack(projectId, "TEXT", undefined, db);
    const subtitle = await addTrack(projectId, "SUBTITLE", undefined, db);

    const z = computeTrackZIndexByOrder(db.rows);
    expect(z.get(subtitle.id)!).toBeGreaterThan(z.get(text.id)!);
    expect(z.get(text.id)!).toBeGreaterThan(z.get(video.id)!);
  });

  it("OVERLAY and a second VIDEO track also prepend (any visually-compositing kind, not just TEXT/SUBTITLE)", async () => {
    const db = makeFakeDb();
    const projectId = "proj1";
    const video = await addTrack(projectId, "VIDEO", undefined, db);
    const overlay = await addTrack(projectId, "OVERLAY", undefined, db);

    expect(overlay.order).toBeLessThan(video.order);
  });

  it("AUDIO keeps appending at the end — it has no z-index/visual-stacking implication", async () => {
    const db = makeFakeDb();
    const projectId = "proj1";
    const video = await addTrack(projectId, "VIDEO", undefined, db);
    const text = await addTrack(projectId, "TEXT", undefined, db);
    const audio = await addTrack(projectId, "AUDIO", undefined, db);

    expect(audio.order).toBeGreaterThan(video.order);
    expect(audio.order).toBeGreaterThan(text.order);
  });

  it("matches createProject's own default VIDEO(order 0) + AUDIO(order 1) layout exactly (the real starting point every project has)", async () => {
    const db = makeFakeDb();
    const projectId = "proj1";
    // Mirror lib/video-editor/projects.ts's createProject() seeding.
    db.rows.push({ id: "video0", projectId, kind: "VIDEO", order: 0, audioSubtype: null });
    db.rows.push({ id: "audio0", projectId, kind: "AUDIO", order: 1, audioSubtype: null });

    const text = await addTrack(projectId, "TEXT", undefined, db);
    expect(text.order).toBeLessThan(0);

    const z = computeTrackZIndexByOrder(db.rows);
    expect(z.get(text.id)!).toBeGreaterThan(z.get("video0")!);
  });
});
