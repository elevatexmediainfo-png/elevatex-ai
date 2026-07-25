import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local", override: true });

// Replays exactly the sequence the FIXED client now produces, against two
// industries that are NOT Dental/Restaurant (those have real admin content
// already — SALON_SPA and RETAIL are used instead so nothing real is
// touched). Captures and restores original values regardless of outcome.
async function main() {
  const { upsertGuidanceNote, listGuidanceNotes } = await import("../src/lib/admin/reference-library");

  const before = await listGuidanceNotes();
  const originalA = before.find((n) => n.industry === "SALON_SPA")!.notes;
  const originalB = before.find((n) => n.industry === "RETAIL")!.notes;
  console.log(`Original SALON_SPA note: ${JSON.stringify(originalA)}`);
  console.log(`Original RETAIL note: ${JSON.stringify(originalB)}`);

  try {
    console.log("Step 1: save SALON_SPA note (simulating tab switch away from it)");
    await upsertGuidanceNote("SALON_SPA", "SALON: book-your-appointment CTA, soft palette");

    console.log("Step 2: read RETAIL's note (simulating landing on Retail tab)");
    let notes = await listGuidanceNotes();
    const retailAfterStep1 = notes.find((n) => n.industry === "RETAIL")!.notes;
    console.log(`  RETAIL note after SALON_SPA save: ${JSON.stringify(retailAfterStep1)} (expect unchanged: ${JSON.stringify(originalB)})`);

    console.log("Step 3: save RETAIL note (simulating tab switch away from it)");
    await upsertGuidanceNote("RETAIL", "RETAIL: shop-now CTA, bold pricing");

    console.log("Step 4: read SALON_SPA's note (simulating landing back on Salon tab)");
    notes = await listGuidanceNotes();
    const salonAfterStep3 = notes.find((n) => n.industry === "SALON_SPA")!.notes;
    const retailFinal = notes.find((n) => n.industry === "RETAIL")!.notes;
    console.log(`  SALON_SPA note after RETAIL save: ${JSON.stringify(salonAfterStep3)} (expect "SALON: book-your-appointment CTA, soft palette")`);
    console.log(`  RETAIL note (final): ${JSON.stringify(retailFinal)} (expect "RETAIL: shop-now CTA, bold pricing")`);

    const ok =
      salonAfterStep3 === "SALON: book-your-appointment CTA, soft palette" &&
      retailFinal === "RETAIL: shop-now CTA, bold pricing" &&
      retailAfterStep1 === originalB;
    console.log(ok ? "INDEPENDENCE_CONFIRMED" : "INDEPENDENCE_FAILED");
  } finally {
    // Always restore, even if an assertion above failed.
    await upsertGuidanceNote("SALON_SPA", originalA);
    await upsertGuidanceNote("RETAIL", originalB);
    const after = await listGuidanceNotes();
    const restoredA = after.find((n) => n.industry === "SALON_SPA")!.notes;
    const restoredB = after.find((n) => n.industry === "RETAIL")!.notes;
    console.log(`Restored SALON_SPA: ${JSON.stringify(restoredA)} — matches original: ${restoredA === originalA}`);
    console.log(`Restored RETAIL: ${JSON.stringify(restoredB)} — matches original: ${restoredB === originalB}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
