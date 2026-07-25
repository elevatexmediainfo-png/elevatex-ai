import { config } from "dotenv";
import sharp from "sharp";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

config({ path: ".env" });
config({ path: ".env.local", override: true });

// STANDALONE PROTOTYPE BATCH — not wired into any production path.
// Validates the "any face fails" head-containment design: run blazeface
// once per photo (pure-JS CPU backend, no native deps), collect every
// detected face's box, then for each candidate boundary check whether ANY
// face's chin (box bottom) lands below it. Zero detections = FAIL SAFE
// (never silently pass an unverified photo) — logged separately so the
// real "detector found nothing" rate is visible, not hidden inside a
// generic fail count.
//
// Two sample sets:
//  - 17 FRESH single-shot generations across industries (unbiased read of
//    real generation variance, same discipline as the earlier top-zone
//    batches).
//  - 3 KNOWN-BAD raw backgrounds (prisma/../scratchpad/headclip_raw_*.jpg)
//    saved from the original head-clipping discovery earlier this session
//    — these are photos we KNOW produced a clipped head in the final
//    composited poster at the 52% boundary, so they're a direct check that
//    "any face fails" actually catches the real failure case, not just a
//    plausibility check on fresh unknowns.

const CANDIDATE_BOUNDARIES = [0.52, 0.55, 0.58, 0.6];

const SCRATCHPAD_DIR =
  "C:\\Users\\ASUS\\AppData\\Local\\Temp\\claude\\c--Users-ASUS-Desktop-Elevatex-Ai\\69d3fec1-e9f5-40aa-8383-86c1da34c17a\\scratchpad";
const KNOWN_BAD_FILES = ["headclip_raw_1.jpg", "headclip_raw_2.jpg", "headclip_raw_3.jpg"];

const SAMPLE_SPECS: { industry: string; rawIdea: string }[] = [
  { industry: "DENTAL_DIAGNOSTIC", rawIdea: "A friendly Indian dentist in a modern clinic, promoting dental implants" },
  { industry: "DENTAL_DIAGNOSTIC", rawIdea: "A dental checkup camp announcement for a family dental clinic" },
  { industry: "DENTAL_DIAGNOSTIC", rawIdea: "A smiling patient after a teeth whitening treatment at a dental clinic" },
  { industry: "RESTAURANT", rawIdea: "A chef presenting a signature dish at a busy Indian restaurant" },
  { industry: "RESTAURANT", rawIdea: "A weekend buffet offer at a family restaurant" },
  { industry: "RESTAURANT", rawIdea: "A waiter serving a fresh biryani at a restaurant table" },
  { industry: "GYM_FITNESS", rawIdea: "A personal trainer motivating a client at a modern gym" },
  { industry: "GYM_FITNESS", rawIdea: "A new gym membership offer with a fit trainer in the frame" },
  { industry: "GYM_FITNESS", rawIdea: "A yoga instructor leading a fitness class" },
  { industry: "SALON_SPA", rawIdea: "A hairstylist giving a haircut at a modern salon" },
  { industry: "SALON_SPA", rawIdea: "A spa therapist promoting a relaxing facial treatment" },
  { industry: "RETAIL", rawIdea: "A shop owner showcasing a new clothing collection in store" },
  { industry: "RETAIL", rawIdea: "A festive sale announcement with a store staff member" },
  { industry: "COACHING_EDTECH", rawIdea: "A coaching institute teacher promoting new batch admissions" },
  { industry: "HOSPITAL", rawIdea: "A doctor promoting a free health checkup camp at a clinic" },
  { industry: "HOTEL", rawIdea: "A hotel staff member welcoming guests at the reception" },
  { industry: "FINANCE", rawIdea: "A financial advisor discussing investment plans with a client" },
];

interface FaceBox {
  topPercent: number;
  bottomPercent: number;
}

interface SampleResult {
  label: string;
  facesDetected: number;
  boxes: FaceBox[];
  error?: string;
}

// The "any face fails" rule: zero detections is NOT a pass — it means the
// photo could not be verified, and must be treated the same as a real
// failure so the retry loop keeps trying rather than trusting an
// unverified image.
function passesBoundary(sample: SampleResult, boundaryPercent: number): boolean {
  if (sample.error || sample.facesDetected === 0) return false;
  return sample.boxes.every((b) => b.bottomPercent <= boundaryPercent);
}

async function detectFaces(
  tf: typeof import("@tensorflow/tfjs"),
  model: Awaited<ReturnType<typeof import("@tensorflow-models/blazeface").load>>,
  buffer: Buffer
): Promise<{ boxes: FaceBox[]; width: number; height: number }> {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const tensor = tf.tensor3d(new Uint8Array(data), [height, width, channels]);
  const predictions = await model.estimateFaces(tensor, false);
  tensor.dispose();

  const boxes: FaceBox[] = predictions.map((p) => {
    const tl = p.topLeft as [number, number];
    const br = p.bottomRight as [number, number];
    return { topPercent: (tl[1] / height) * 100, bottomPercent: (br[1] / height) * 100 };
  });
  return { boxes, width, height };
}

async function main() {
  const tf = await import("@tensorflow/tfjs");
  const blazeface = await import("@tensorflow-models/blazeface");
  const { buildCleanBackgroundPrompt } = await import("../src/lib/creative/clean-background-prompt");
  const { INDUSTRY_POSTER_META } = await import("../src/lib/creative/poster-prompt");
  const { generateImage } = await import("../src/lib/generation/image");
  const { toBuffer } = await import("../src/lib/image/fetch-bytes");

  console.log("Loading blazeface model...");
  const model = await blazeface.load();
  console.log("Model loaded.\n");

  const results: SampleResult[] = [];
  const outDir = path.join(process.cwd(), "prisma", "_head_measurement_output");
  await mkdir(outDir, { recursive: true });
  let annotatedSaved = 0;

  // ── Known-bad fixed cases first ──────────────────────────────────────
  for (const file of KNOWN_BAD_FILES) {
    console.log(`[KNOWN-BAD] ${file}`);
    try {
      const buffer = await readFile(path.join(SCRATCHPAD_DIR, file));
      const { boxes, width, height } = await detectFaces(tf, model, buffer);
      console.log(`  faces detected: ${boxes.length}`);
      for (const b of boxes) console.log(`    box bottom=${b.bottomPercent.toFixed(1)}%`);
      results.push({ label: `KNOWN-BAD:${file}`, facesDetected: boxes.length, boxes });

      const svgLines = boxes
        .map((b, i) => {
          const y = Math.round((b.bottomPercent / 100) * height);
          return (
            `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#00ff00" stroke-width="6"/>` +
            `<text x="10" y="${y - 10}" font-size="34" fill="#00ff00" font-family="sans-serif" font-weight="bold">face${i} bottom ${b.bottomPercent.toFixed(1)}%</text>`
          );
        })
        .join("");
      const overlay = Buffer.from(`<svg width="${width}" height="${height}">${svgLines}</svg>`);
      const annotated = await sharp(buffer).composite([{ input: overlay, top: 0, left: 0 }]).jpeg({ quality: 90 }).toBuffer();
      await writeFile(path.join(outDir, `anyface_knownbad_${file}`), annotated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ERROR: ${message}`);
      results.push({ label: `KNOWN-BAD:${file}`, facesDetected: 0, boxes: [], error: message });
    }
  }

  // ── Fresh generations ────────────────────────────────────────────────
  for (let i = 0; i < SAMPLE_SPECS.length; i++) {
    const spec = SAMPLE_SPECS[i];
    const meta = (INDUSTRY_POSTER_META as Record<string, { label: string; cta: string }>)[spec.industry];
    const label = `${i + 1}/${SAMPLE_SPECS.length} ${spec.industry}`;
    console.log(`\n[${label}] "${spec.rawIdea}"`);

    try {
      const prompt = buildCleanBackgroundPrompt({ rawIdea: spec.rawIdea, industryLabel: meta?.label ?? null, visualStyle: null });
      const gen = await generateImage({ prompt, aspectRatio: "RATIO_9_16" }, "creative_image", { userId: "measure-anyface-script" });
      const { buffer } = await toBuffer(gen.imageUrl);
      const { boxes, width, height } = await detectFaces(tf, model, buffer);

      console.log(`  faces detected: ${boxes.length}`);
      for (const b of boxes) console.log(`    box bottom=${b.bottomPercent.toFixed(1)}%`);
      results.push({ label: `${spec.industry}#${i + 1}`, facesDetected: boxes.length, boxes });

      if (annotatedSaved < 8) {
        const svgLines = boxes
          .map((b, idx) => {
            const y = Math.round((b.bottomPercent / 100) * height);
            return (
              `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#00ff00" stroke-width="5"/>` +
              `<text x="10" y="${y - 8}" font-size="30" fill="#00ff00" font-family="sans-serif" font-weight="bold">face${idx} ${b.bottomPercent.toFixed(1)}%</text>`
            );
          })
          .join("");
        const overlay = Buffer.from(`<svg width="${width}" height="${height}">${svgLines}</svg>`);
        const annotated = await sharp(buffer).composite([{ input: overlay, top: 0, left: 0 }]).jpeg({ quality: 90 }).toBuffer();
        await writeFile(path.join(outDir, `anyface_${i + 1}_${spec.industry}.jpg`), annotated);
        annotatedSaved++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ERROR: ${message}`);
      results.push({ label: `${spec.industry}#${i + 1}`, facesDetected: 0, boxes: [], error: message });
    }
  }

  // ── Report ────────────────────────────────────────────────────────────
  console.log("\n\n========== SUMMARY ==========");
  const freshResults = results.filter((r) => !r.label.startsWith("KNOWN-BAD"));
  const knownBadResults = results.filter((r) => r.label.startsWith("KNOWN-BAD"));

  const errored = freshResults.filter((r) => r.error).length;
  const zeroDetections = freshResults.filter((r) => !r.error && r.facesDetected === 0).length;
  console.log(`Fresh samples: ${freshResults.length}, errored: ${errored}, zero-face-detections: ${zeroDetections}`);

  console.log("\n--- Known-bad cases (should FAIL at 52%, the boundary that produced real clipping) ---");
  for (const r of knownBadResults) {
    const pass52 = passesBoundary(r, 52);
    console.log(`${r.label}: faces=${r.facesDetected}, passes-52%=${pass52} ${pass52 ? "(UNEXPECTED — should fail)" : "(correctly flags the known-bad case)"}`);
  }

  console.log("\n--- Pass rate per boundary (fresh samples only) ---");
  for (const boundaryFrac of CANDIDATE_BOUNDARIES) {
    const boundaryPercent = boundaryFrac * 100;
    const passCount = freshResults.filter((r) => passesBoundary(r, boundaryPercent)).length;
    const p = passCount / freshResults.length;
    const theoreticalWithin3 = 1 - Math.pow(1 - p, 3);
    const colorZonePercent = (100 - boundaryPercent).toFixed(0);
    console.log(
      `boundary=${boundaryPercent}%: pass ${passCount}/${freshResults.length} (${(p * 100).toFixed(0)}%), ` +
        `theoretical pass-within-3-attempts ${(theoreticalWithin3 * 100).toFixed(0)}%, resulting color-zone=${colorZonePercent}%`
    );
  }

  console.log("\n--- Per-sample detail ---");
  for (const r of freshResults) {
    const flags = CANDIDATE_BOUNDARIES.map((b) => `${Math.round(b * 100)}%:${passesBoundary(r, b * 100) ? "OK" : "FAIL"}`).join(" ");
    console.log(`${r.label}: faces=${r.facesDetected}${r.error ? ` ERROR(${r.error})` : ""} — ${flags}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
