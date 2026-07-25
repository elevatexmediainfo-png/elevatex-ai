// Regression test for a real, severe bug found + fixed 2026-07-19 (see
// PROJECT_STATUS.md's own entry): the site-wide decorative 3D background
// (components/background/background-scene.tsx) wraps its <Canvas> in a
// pointer-events:none div — but @react-three/fiber's own internal Canvas
// wrapper sets pointer-events:auto on itself by default, silently
// overriding that. Because this wrapper is `position: fixed`, it then
// paints/hit-tests ABOVE any plain `position: static` content — which
// swallows clicks on any real interactive element with no positioned
// ancestor of its own. Confirmed live on the real /login page's actual
// "Continue with Google"/"Send OTP" buttons and the editor's Play button,
// in BOTH dev and production.
//
// The critical, easy-to-miss property that makes this bug class hard to
// catch: it is NOT present immediately on page load — it activates
// roughly 3-4 seconds after navigation and then persists indefinitely. A
// naive test that clicks right after `waitForSelector` resolves would
// NEVER catch this (confirmed: this exact false-negative happened
// repeatedly during the original investigation, since virtually every
// prior test script in this project clicked well within that safe
// window). This test deliberately waits well past that window (10s, over
// double the observed ~3-4s activation point) before asserting anything,
// on TWO independently affected real pages/buttons.
//
// Run manually against an already-running dev (or production) server:
//   npx tsx scripts/regression/canvas-pointer-events.mts
// Exits 0 on pass, 1 on failure — safe to wire into CI once this repo
// has a CI job that can run a live browser + server (none exists yet).

import { chromium, type Page } from "playwright";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error — ffmpeg-static ships no types, matches this repo's
// existing usage pattern in lib/video-editor/ffmpeg-exec.ts.
import ffmpegPath from "ffmpeg-static";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const BASE = process.env.REGRESSION_BASE_URL ?? "http://localhost:3000";
const ACTIVATION_WAIT_MS = 10_000; // >2x the observed ~3-4s activation window

const results: { name: string; pass: boolean; detail?: string }[] = [];
function report(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? " — " + detail : ""}`);
}

async function api<T>(page: Page, method: string, path: string, body?: unknown): Promise<T> {
  return page.evaluate(
    async ({ method, path, body }) => {
      const res = await fetch(path, {
        method,
        credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
      return json;
    },
    { method, path, body }
  ) as Promise<T>;
}

// Takes a plain CSS selector (querySelector-compatible, NOT Playwright's
// :has-text() pseudo-selector syntax) so this works inside page.evaluate.
async function elementHitsCorrectly(page: Page, selector: string): Promise<{ ok: boolean; atPointTag?: string }> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { ok: false, atPointTag: "(selector not found)" };
    const rect = el.getBoundingClientRect();
    const atPoint = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return { ok: atPoint === el || el.contains(atPoint), atPointTag: atPoint?.tagName };
  }, selector);
}

// Same idea, but for elements only findable by their text content (no
// stable selector exists) — used for the language-toggle button.
async function elementHitsCorrectlyByText(page: Page, tag: string, text: string): Promise<{ ok: boolean; atPointTag?: string }> {
  return page.evaluate(
    ({ tag, text }) => {
      const el = Array.from(document.querySelectorAll(tag)).find((e) => e.textContent?.includes(text));
      if (!el) return { ok: false, atPointTag: "(not found)" };
      const rect = el.getBoundingClientRect();
      const atPoint = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return { ok: atPoint === el || el.contains(atPoint), atPointTag: atPoint?.tagName };
    },
    { tag, text }
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.setDefaultTimeout(30000);

  // --- Root-cause regression check: the canvas itself must have
  // pointer-events:none, on ANY page (this is a single global fix). ---
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(ACTIVATION_WAIT_MS);
  const canvasPointerEvents = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    return canvas ? getComputedStyle(canvas).pointerEvents : "(no canvas found)";
  });
  report(
    "Background canvas has pointer-events:none (the actual fix)",
    canvasPointerEvents === "none",
    `computed value: ${canvasPointerEvents}`
  );

  // --- Scenario 1: /login page's real buttons, past the activation
  // window, using a real (non-forced) click that must trigger a genuine
  // side effect — not just "click() didn't throw". The language toggle
  // is used (not Send OTP/Continue with Google) since those have real
  // external side effects (SMS send, OAuth redirect) unsafe to trigger
  // repeatedly in an automated regression run. ---
  await page.goto(`${BASE}/login`, { waitUntil: "load" });
  await page.waitForTimeout(ACTIVATION_WAIT_MS);

  const langHit = await elementHitsCorrectlyByText(page, "button", "हिंदी");
  report("/login language-toggle button hit-tests correctly (elementFromPoint)", langHit.ok, JSON.stringify(langHit));

  // The toggle is a self-contained visual toggle (see its own comment in
  // language-toggle.tsx — full i18next wiring is a future milestone): a
  // real click flips its own button text "हिंदी" <-> "English", not
  // document.documentElement.lang.
  const textBefore = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("हिंदी"))?.textContent?.trim()
  );
  await page.locator('button:has-text("हिंदी")').click(); // real click, NOT force:true — this is the actual regression guard
  await page.waitForTimeout(500);
  const textAfter = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("English"))?.textContent?.trim()
  );
  report(
    "/login language-toggle real click triggers a genuine side effect (button label changed to English)",
    Boolean(textBefore?.includes("हिंदी")) && Boolean(textAfter?.includes("English")),
    `before=${textBefore} after=${textAfter}`
  );

  // --- Scenario 2: the editor's Play button — the originally-reported
  // bug. Needs a real project with at least one clip (the button is
  // `disabled` on an empty timeline) — generate a tiny synthetic clip on
  // the fly via ffmpeg-static so this test has no dependency on any
  // session-specific or committed binary fixture file. ---
  const tempDir = await mkdtemp(join(tmpdir(), "canvas-regression-"));
  const clipPath = join(tempDir, "tiny-test-clip.mp4");
  await run(ffmpegPath as unknown as string, [
    "-y",
    "-f", "lavfi", "-i", "color=c=blue:s=320x240:d=3:r=30",
    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
    "-shortest",
    "-c:v", "libx264", "-c:a", "aac", "-pix_fmt", "yuv420p",
    clipPath,
  ]);

  await page.goto(`${BASE}/dev-admin-login`, { waitUntil: "load" });
  const hasDevLogin = await page.locator("#phone").count();
  if (hasDevLogin === 0) {
    report("Editor Play-button scenario", true, "SKIPPED — dev-admin-login not available in this environment (expected in production)");
  } else {
    await page.fill("#phone", "9876500022");
    await page.click('button:has-text("Sign in as admin")');
    // Generous timeout — the background scene (components/background/
    // background-scene.tsx) is a real, actively-evolving 3D component;
    // heavier revisions add real page-load/compile contention unrelated
    // to what this test is actually checking.
    await page.waitForURL(/\/admin/, { timeout: 45000 });

    const uploadProj = await api<{ data: { project: { id: string } } }>(page, "POST", "/api/editor/projects", {
      name: "regression-canvas-upload-source",
      aspectRatio: "RATIO_16_9",
      widthPx: 1280,
      heightPx: 720,
    });
    await page.goto(`${BASE}/editor/${uploadProj.data.project.id}`);
    await page.waitForSelector('button:has-text("Add Track")', { timeout: 30000 });
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Import")').click();
    await page.locator('input[type="file"]').first().setInputFiles(clipPath);
    await page.waitForSelector(`text=tiny-test-clip.mp4`, { timeout: 30000 });
    const assets = await api<{ data: { assets: { id: string; originalFilename: string; durationSeconds: number | null }[] } }>(
      page,
      "GET",
      `/api/editor/assets?projectId=${uploadProj.data.project.id}`
    );
    const asset = assets.data.assets.find((a) => a.originalFilename === "tiny-test-clip.mp4");
    if (!asset) throw new Error("test clip asset not found after upload");

    const proj = await api<{ data: { project: { id: string } } }>(page, "POST", "/api/editor/projects", {
      name: "REGRESSION canvas-pointer-events — " + new Date().toISOString(),
      aspectRatio: "RATIO_16_9",
      widthPx: 1280,
      heightPx: 720,
    });
    const projectId = proj.data.project.id;
    const ws = await api<{ data: { tracks: { id: string; kind: string }[] } }>(page, "GET", `/api/editor/projects/${projectId}`);
    const videoTrackId = ws.data.tracks.find((t) => t.kind === "VIDEO")!.id;
    const durationMs = Math.round((asset.durationSeconds ?? 3) * 1000);
    await api(page, "POST", `/api/editor/projects/${projectId}/clips`, {
      trackId: videoTrackId,
      assetId: asset.id,
      startMs: 0,
      trimStartMs: 0,
      durationMs,
    });

    await page.goto(`${BASE}/editor/${projectId}`);
    await page.waitForSelector('button:has-text("Add Track")', { timeout: 30000 });
    await page.waitForTimeout(ACTIVATION_WAIT_MS);

    const playSelector = 'button[title="Previous frame (←)"] + button';
    const playHit = await elementHitsCorrectly(page, playSelector);
    report("Editor Play button hit-tests correctly (elementFromPoint), past activation window", playHit.ok, JSON.stringify(playHit));

    const pausedBefore = await page.evaluate(() => document.querySelector("video[data-clip-id]:not([data-slot-idle])")?.paused);
    await page.locator(playSelector).click(); // real click, NOT force:true
    await page.waitForTimeout(500);
    const pausedAfter = await page.evaluate(() => document.querySelector("video[data-clip-id]:not([data-slot-idle])")?.paused);
    report(
      "Editor Play button real click triggers a genuine side effect (video actually started playing)",
      pausedBefore === true && pausedAfter === false,
      `paused before=${pausedBefore} after=${pausedAfter}`
    );

    await api(page, "DELETE", `/api/editor/projects/${projectId}`);
    await api(page, "DELETE", `/api/editor/projects/${uploadProj.data.project.id}`);
  }

  await rm(tempDir, { recursive: true, force: true });
  await browser.close();

  console.log("\n=== SUMMARY ===");
  const failed = results.filter((r) => !r.pass);
  console.log(`${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("SCRIPT ERROR:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
