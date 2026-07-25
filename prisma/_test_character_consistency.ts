import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { prisma } from "../src/lib/prisma";
import { getStorageProvider } from "../src/lib/providers/storage";
import { generateVeoLiteVideo, type GenerateVeoLiteVideoResult } from "../src/lib/creative/veo-lite-video";
import { extractLastFrame, runFfmpeg } from "../src/lib/video-editor/ffmpeg-exec";
import { recordAsset } from "../src/lib/assets/service";

const USER_ID = "cmqy0nach0000bwu717l1vseb";
const OUT_DIR = path.join(__dirname, "_consistency_test");

const CHARACTER = "an Indian chef in a white chef's uniform and toque, with a neat mustache";
const CLIP1_PROMPT = `A confident ${CHARACTER}, standing in a professional restaurant kitchen with steel countertops, smiling warmly at the camera with arms crossed. Photorealistic, professional advertising quality, warm kitchen lighting.`;
const CONTINUATION_PROMPTS = [
  `The same ${CHARACTER} from the reference image continues in the kitchen, now chopping fresh vegetables on a cutting board with focused expression. Photorealistic, professional advertising quality, same kitchen setting.`,
  `The same ${CHARACTER} from the reference image plates a finished dish on a white plate with careful precision. Photorealistic, professional advertising quality, same kitchen setting.`,
  `The same ${CHARACTER} from the reference image tastes the finished dish with a spoon and smiles with satisfaction at the camera. Photorealistic, professional advertising quality, same kitchen setting.`,
];

function log(label: string, t0: number) {
  console.log("[" + ((Date.now() - t0) / 1000).toFixed(0) + "s] " + label);
}

function toPosixPath(p: string): string {
  return p.split(path.sep).join("/");
}

async function bridgeFrameAsAsset(buffer: Buffer, mimeType: string, label: string): Promise<string> {
  const storage = await getStorageProvider();
  const uploaded = await storage.upload({ key: "creative-video/" + USER_ID + "/" + Date.now() + "-" + label + ".png", data: buffer, contentType: mimeType });
  const asset = await recordAsset({ userId: USER_ID, kind: "IMAGE", source: "AI_GENERATED", storageKey: uploaded.key, label });
  return asset.id;
}

async function downloadClip(clip: GenerateVeoLiteVideoResult): Promise<Buffer> {
  const storage = await getStorageProvider();
  return storage.download(clip.storageKey);
}

async function concatClips(buffers: Buffer[], outPath: string): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "concat-"));
  const listPath = path.join(tempDir, "list.txt");
  const lines: string[] = [];
  for (let i = 0; i < buffers.length; i++) {
    const p = path.join(tempDir, "clip" + i + ".mp4");
    fs.writeFileSync(p, buffers[i]);
    lines.push("file '" + toPosixPath(p) + "'");
  }
  fs.writeFileSync(listPath, lines.join("\n"));
  await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath]);
  fs.rmSync(tempDir, { recursive: true, force: true });
}

async function main() {
  const t0 = Date.now();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const before = await prisma.creditAccount.findUnique({ where: { userId: USER_ID } });
  log("Balance BEFORE: " + before?.balance, t0);

  log("Generating shared Clip 1 (reference)...", t0);
  const clip1 = await generateVeoLiteVideo({ userId: USER_ID, prompt: CLIP1_PROMPT, aspectRatio: "RATIO_9_16" });
  log("Clip 1 done: " + clip1.assetId, t0);
  const clip1Buffer = await downloadClip(clip1);
  fs.writeFileSync(path.join(OUT_DIR, "clip1_reference.mp4"), clip1Buffer);
  const clip1LastFrame = await extractLastFrame(clip1Buffer);
  const referenceAssetId = await bridgeFrameAsAsset(clip1LastFrame.buffer, clip1LastFrame.mimeType, "clip1-last-frame-reference");
  log("Clip 1 last frame extracted and bridged as the fixed reference image", t0);

  log("=== VARIANT A: last-frame chaining ===", t0);
  const variantAClips: GenerateVeoLiteVideoResult[] = [clip1];
  const variantABuffers: Buffer[] = [clip1Buffer];
  let chainStartImage = referenceAssetId;
  for (let i = 0; i < CONTINUATION_PROMPTS.length; i++) {
    log("Variant A: generating clip " + (i + 2) + "/4 (from previous clip's last frame)...", t0);
    const clip = await generateVeoLiteVideo({ userId: USER_ID, prompt: CONTINUATION_PROMPTS[i], aspectRatio: "RATIO_9_16", startImageAssetId: chainStartImage });
    variantAClips.push(clip);
    const buf = await downloadClip(clip);
    variantABuffers.push(buf);
    fs.writeFileSync(path.join(OUT_DIR, "variantA_clip" + (i + 2) + ".mp4"), buf);
    log("Variant A clip " + (i + 2) + "/4 done: " + clip.assetId, t0);
    if (i < CONTINUATION_PROMPTS.length - 1) {
      const frame = await extractLastFrame(buf);
      chainStartImage = await bridgeFrameAsAsset(frame.buffer, frame.mimeType, "variantA-clip" + (i + 2) + "-last-frame");
    }
  }
  await concatClips(variantABuffers, path.join(OUT_DIR, "variantA_joined.mp4"));
  log("Variant A: 4 clips joined -> variantA_joined.mp4", t0);

  log("=== VARIANT B: reference-anchored (same start image every time) ===", t0);
  const variantBClips: GenerateVeoLiteVideoResult[] = [clip1];
  const variantBBuffers: Buffer[] = [clip1Buffer];
  for (let i = 0; i < CONTINUATION_PROMPTS.length; i++) {
    log("Variant B: generating clip " + (i + 2) + "/4 (from the ORIGINAL reference frame)...", t0);
    const clip = await generateVeoLiteVideo({ userId: USER_ID, prompt: CONTINUATION_PROMPTS[i], aspectRatio: "RATIO_9_16", startImageAssetId: referenceAssetId });
    variantBClips.push(clip);
    const buf = await downloadClip(clip);
    variantBBuffers.push(buf);
    fs.writeFileSync(path.join(OUT_DIR, "variantB_clip" + (i + 2) + ".mp4"), buf);
    log("Variant B clip " + (i + 2) + "/4 done: " + clip.assetId, t0);
  }
  await concatClips(variantBBuffers, path.join(OUT_DIR, "variantB_joined.mp4"));
  log("Variant B: 4 clips joined -> variantB_joined.mp4", t0);

  const after = await prisma.creditAccount.findUnique({ where: { userId: USER_ID } });
  const totalCharged =
    variantAClips.reduce((s, c) => s + c.creditsCharged, 0) +
    variantBClips.slice(1).reduce((s, c) => s + c.creditsCharged, 0);
  log("Balance AFTER: " + after?.balance + " (charged " + totalCharged + " total across 7 unique clips)", t0);

  console.log("ALL DONE");
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  });
