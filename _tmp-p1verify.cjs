const TOKEN = process.argv[2];
const IDEAS = [
  { prompt: "Dental Implant Informative Creative", kind: "SOCIAL_MEDIA", presetKey: "instagram_post" },
  { prompt: "Restaurant Grand Opening", kind: "SOCIAL_MEDIA", presetKey: "instagram_post" },
  { prompt: "Luxury Real Estate Villa", kind: "MARKETING_CREATIVE", presetKey: "poster" },
  { prompt: "Hospital Health Checkup", kind: "SOCIAL_MEDIA", presetKey: "instagram_post" },
];

(async () => {
  for (const idea of IDEAS) {
    process.stdout.write(`Testing: ${idea.prompt}... `);
    const res = await fetch("http://localhost:3000/api/creative-projects/enhance-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `authjs.session-token=${TOKEN}` },
      body: JSON.stringify(idea),
    });
    const json = await res.json();
    if (!json.success) {
      console.log(`FAIL (${res.status}): ${JSON.stringify(json.error)}`);
    } else {
      const cb = json.data.universalPrompt?.creativeBrief;
      console.log(`OK (${json.data.enhancedPrompt?.length} chars, visualFormat: ${cb?.visualFormat ?? "n/a"}, headline: "${cb?.copywriting?.headline ?? "n/a"}")`);
    }
  }
})();
