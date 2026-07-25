const TOKEN = process.argv[2];

(async () => {
  console.log("=== STEP 1: enhance-prompt request ===");
  const enhanceBody = { prompt: "Luxury Real Estate Villa", kind: "MARKETING_CREATIVE", presetKey: "poster" };
  console.log("Payload:", JSON.stringify(enhanceBody));

  const enhanceRes = await fetch("http://localhost:3000/api/creative-projects/enhance-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `authjs.session-token=${TOKEN}` },
    body: JSON.stringify(enhanceBody),
  });
  const enhanceJson = await enhanceRes.json();
  console.log("HTTP status:", enhanceRes.status);
  if (!enhanceJson.success) {
    console.log("enhance-prompt FAILED:", JSON.stringify(enhanceJson.error, null, 2));
    return;
  }
  const enhancedPrompt = enhanceJson.data.enhancedPrompt;
  console.log("enhancedPrompt length:", enhancedPrompt.length);
  console.log("(createCreativeProjectSchema.prompt max is 4500 — exceeds?", enhancedPrompt.length > 4500, ")");

  console.log("\n=== STEP 2: POST /api/creative-projects (the actual Generate button request) ===");
  const generateBody = {
    kind: "MARKETING_CREATIVE",
    presetKey: "poster",
    title: enhancedPrompt.trim().slice(0, 60),
    prompt: enhancedPrompt,
    contentLanguage: "EN",
    universalPrompt: enhanceJson.data.universalPrompt,
  };
  console.log("Payload field lengths: title=" + generateBody.title.length + " prompt=" + generateBody.prompt.length);

  const genRes = await fetch("http://localhost:3000/api/creative-projects", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `authjs.session-token=${TOKEN}` },
    body: JSON.stringify(generateBody),
  });
  const genJson = await genRes.json();
  console.log("\n=== FULL RESPONSE ===");
  console.log("HTTP status:", genRes.status);
  console.log(JSON.stringify(genJson, null, 2));
})();
