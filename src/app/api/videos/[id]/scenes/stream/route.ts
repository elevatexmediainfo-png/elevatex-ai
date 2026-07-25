import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { computeProgress, listScenes } from "@/lib/scenes/engine";

const POLL_INTERVAL_MS = 1500;
const TERMINAL_PROJECT_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

// GET /api/videos/[id]/scenes/stream — Server-Sent Events feed of live
// render progress. Honest about what "live" means here: this still polls
// the DB server-side (no pub/sub), it just pushes the diff to the client
// instead of making the client poll — same trade-off lib/admin/config.ts's
// in-process cache documents for a different concern (consistency vs.
// simplicity, chosen deliberately over standing up Redis/WebSockets).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  const project = await prisma.videoProject.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
  }

  const encoder = new TextEncoder();
  let closed = false;
  req.signal.addEventListener("abort", () => {
    closed = true;
  });

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      let lastSnapshot = "";
      try {
        while (!closed) {
          const [scenes, current] = await Promise.all([
            listScenes(id),
            prisma.videoProject.findUnique({
              where: { id },
              select: { status: true, errorMessage: true },
            }),
          ]);
          if (!current) break;

          const progress = computeProgress(scenes);
          const snapshot = JSON.stringify({ scenes, progress, project: current });
          if (snapshot !== lastSnapshot) {
            send("update", { scenes, progress, project: current });
            lastSnapshot = snapshot;
          }

          if (TERMINAL_PROJECT_STATUSES.has(current.status)) {
            send("done", { project: current });
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : "Stream failed." });
      } finally {
        controller.close();
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
