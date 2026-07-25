import { chromium } from "playwright";

const BASE = "http://localhost:3000";

const browser = await chromium.launch();
// Fresh, storage-free context — matches an incognito tab exactly (no cookies/localStorage carried over).
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto(`${BASE}/dev-admin-login`, { waitUntil: "networkidle" });
await page.fill("#phone", "9876500022");
await Promise.all([
  page.waitForResponse((res) => res.url().includes("/api/auth/callback/dev-bypass")).catch(() => {}),
  page.click('button:has-text("Sign in as admin")'),
]);
await page.waitForTimeout(1500);

await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

async function inspect(label) {
  const htmlClass = await page.evaluate(() => document.documentElement.className);
  const dataTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const dashBgVar = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--dash-bg").trim());
  const sidebarEl = await page.locator("aside").first();
  let sidebarBg = "N/A";
  try {
    sidebarBg = await sidebarEl.evaluate((el) => getComputedStyle(el).backgroundColor);
  } catch {}
  const localStorageTheme = await page.evaluate(() => localStorage.getItem("theme"));
  console.log(`--- ${label} ---`);
  console.log("  <html> className:", JSON.stringify(htmlClass));
  console.log("  <html> data-theme attr:", dataTheme);
  console.log("  computed --dash-bg value:", dashBgVar);
  console.log("  computed body background-color:", bodyBg);
  console.log("  computed sidebar <aside> background-color:", sidebarBg);
  console.log("  localStorage 'theme' key:", localStorageTheme);
  return { htmlClass, dashBgVar, bodyBg, sidebarBg };
}

const before = await inspect("BEFORE clicking toggle");

const toggle = page.locator('button[aria-label*="Switch to"][aria-label*="mode"]').first();
const toggleLabelBefore = await toggle.getAttribute("aria-label");
console.log("\nToggle button aria-label before click:", toggleLabelBefore);
await toggle.click();
await page.waitForTimeout(1000);
const toggleLabelAfter = await toggle.getAttribute("aria-label");
console.log("Toggle button aria-label after click:", toggleLabelAfter);

const after = await inspect("AFTER clicking toggle");

console.log("\n=== DIFF CHECK ===");
console.log("html className changed:", before.htmlClass !== after.htmlClass);
console.log("--dash-bg value changed:", before.dashBgVar !== after.dashBgVar);
console.log("body background-color changed:", before.bodyBg !== after.bodyBg);
console.log("sidebar background-color changed:", before.sidebarBg !== after.sidebarBg);

// Now simulate a real hard refresh (like the founder did) and re-check persistence.
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const afterReload = await inspect("AFTER hard refresh (page.reload)");
console.log("\nPersisted after reload (className matches post-click state):", afterReload.htmlClass === after.htmlClass);

// Now simulate a genuinely fresh incognito tab: brand new context, brand new page,
// same authenticated cookie jar is NOT carried (new context = new cookies), so log in again.
const context2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page2 = await context2.newPage();
await page2.goto(`${BASE}/dev-admin-login`, { waitUntil: "networkidle" });
await page2.fill("#phone", "9876500022");
await Promise.all([
  page2.waitForResponse((res) => res.url().includes("/api/auth/callback/dev-bypass")).catch(() => {}),
  page2.click('button:has-text("Sign in as admin")'),
]);
await page2.waitForTimeout(1500);
await page2.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await page2.waitForTimeout(1500);
const freshIncognitoClass = await page2.evaluate(() => document.documentElement.className);
const freshIncognitoLS = await page2.evaluate(() => localStorage.getItem("theme"));
console.log("\n--- FRESH INCOGNITO-STYLE CONTEXT (brand new, zero storage) ---");
console.log("  <html> className:", JSON.stringify(freshIncognitoClass));
console.log("  localStorage 'theme' key (should be null, nothing set yet):", freshIncognitoLS);

await browser.close();
console.log("\nDONE");
