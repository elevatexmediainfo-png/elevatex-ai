import type { NextConfig } from "next";

// Milestone 12 — the real external-domain list is now known. Google
// Sign-In (lib/auth/index.ts) is real and live, but it's a full-page
// redirect to accounts.google.com (next-auth's signIn("google") navigates
// away entirely) rather than a script/iframe/fetch loaded into this page —
// CSP governs sub-resource loads, not top-level navigation, so it needs no
// entry here. Razorpay Checkout is the one third-party script/frame this
// app actually loads as a sub-resource (lib/payments/checkout-client.ts).
// Storage (S3/R2/MinIO) is admin/env-configurable to an arbitrary host, so
// img-src/media-src allow any https origin rather than naming one — locking
// that down further would need a CSP rebuild every time an admin points
// Storage at a new endpoint.
const RAZORPAY_ORIGIN = "https://checkout.razorpay.com";
// Real bug fix (2026-07-24, found live) — checkout.razorpay.com alone was
// never enough: a real click-through against a real Razorpay account
// showed the initial checkout.js script loading fine (that host was
// already allowed) but two further, real, required sub-resources both
// silently CSP-blocked — confirmed via the browser's own console errors,
// not assumed from docs: checkout.js's risk-detection bundle loads from
// `cdn.razorpay.com` (a script-src violation), and the actual payment
// iframe itself is served from `api.razorpay.com` (a frame-src
// violation) — `window.Razorpay` existed and `.open()` genuinely ran
// (confirmed via a real analytics beacon reaching Razorpay), but the
// visible payment modal never rendered because its own iframe was never
// allowed to load. Both origins added narrowly (not a `*.razorpay.com`
// wildcard) — only what a real click-through actually needed, re-verified
// after this fix rather than assumed sufficient.
const RAZORPAY_CDN_ORIGIN = "https://cdn.razorpay.com";
const RAZORPAY_API_ORIGIN = "https://api.razorpay.com";

// Dev-mode Next.js wraps webpack modules in eval() for Fast Refresh/source
// maps — without 'unsafe-eval' here, the browser silently blocks that eval
// on every page load, which breaks client-component hydration/event binding
// (e.g. onClick handlers never firing) without throwing anywhere server-side.
// Production's webpack output never uses eval, so this never weakens the
// CSP actually shipped to users — same dev/prod split already used for HSTS.
const scriptSrc =
  process.env.NODE_ENV === "production"
    ? `script-src 'self' 'unsafe-inline' ${RAZORPAY_ORIGIN} ${RAZORPAY_CDN_ORIGIN}`
    : `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${RAZORPAY_ORIGIN} ${RAZORPAY_CDN_ORIGIN}`;

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data: blob:",
  "media-src 'self' https: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  `frame-src ${RAZORPAY_ORIGIN} ${RAZORPAY_API_ORIGIN}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: csp },
  // HSTS is meaningless (and potentially harmful) over plain HTTP dev —
  // only sent when the app is actually running under TLS in production.
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  // Milestone 12 — Docker deployment (Dockerfile's runtime stage copies only
  // .next/standalone + .next/static, not the full node_modules tree).
  // Additive: `next dev`/`next start` are unaffected either way.
  output: "standalone",
  // 2026-07-12 — `next build`'s "Collecting page data" step spawns one
  // worker process per (cpus - 1); on this 12-core dev machine that's 11
  // concurrent workers, which reliably OOM-crashed one mid-write against the
  // ~4GB typically free here (confirmed live: crash reproduced identically
  // under both Turbopack and webpack, always at "Collecting page data",
  // always a "Cannot find module './NNNN.js'" for a chunk that was never
  // finished being written — a worker-crash signature, not a real missing
  // module; cpus:2 still crashed, cpus:1 built clean). Bounding worker count
  // is a build-time-only knob; runtime behavior (`next dev`/`next start`) is
  // unaffected either way.
  // 2026-07-13 — root cause of a real incident: a 176.5MB Talking Head video
  // upload (PUT /api/assets/mock-upload, MockStorageProvider's local-dev
  // upload path) silently wrote only the first 10,485,760 bytes to disk —
  // no error surfaced anywhere, the PUT returned 200, and everything
  // downstream (transcription) faithfully processed the (corrupted,
  // ~4-second-decodable) file it was actually given. Traced to Next.js's
  // documented default: every request matched by middleware.ts's matcher
  // (which is effectively every request in this app, via NextAuth's `auth`
  // wrapper) has its body buffered in memory, capped at
  // middlewareClientMaxBodySize — default 10MB, buffered-and-truncated
  // rather than rejected with an error (confirmed against this exact
  // installed Next.js version, 15.5.19 — its own type declarations name
  // this middlewareClientMaxBodySize; Next's LATEST docs describe the same
  // default under a newer name, proxyClientMaxBodySize, from a v16 rename
  // that hadn't happened yet in this install — verified directly against
  // node_modules/next's shipped .d.ts rather than trusting the docs
  // version). Raised to 2GB to match this app's own existing intended
  // ceiling for large media (EDITOR_MAX_UPLOAD_SIZE_BYTES's default,
  // lib/admin/config.ts). Production is NOT exposed to this today —
  // S3StorageProvider hands the browser a presigned URL pointing directly
  // at S3/R2, so a real deploy's uploads never pass through this app's own
  // server/middleware at all — but raising it here removes a
  // silent-corruption trap for anyone still on local/mock storage, and for
  // any other >10MB body any mutating route might someday receive.
  experimental: { cpus: 1, middlewareClientMaxBodySize: "2gb" },
  // Module 10 — both packages resolve a NATIVE BINARY's filesystem path via
  // `__dirname` at require-time (ffmpeg-static: the bundled ffmpeg.exe;
  // playwright: its browser-launcher internals). Bundling them into the
  // server's webpack/Turbopack output rewrites `__dirname` to a synthetic
  // bundle-relative path ("\ROOT\node_modules\..."), which doesn't exist on
  // disk — spawn ENOENT. Marking them external makes Next.js `require()`
  // them normally at real runtime instead (and, for `output: "standalone"`,
  // ensures their actual files get traced/copied rather than silently
  // dropped as "unreachable" by the bundler's static analysis).
  // Upload normalization (2026-07-19) — ffprobe-static hits the exact same
  // __dirname-at-require-time issue described above (confirmed live: a
  // bundled probeMediaFile() call resolved to "\ROOT\node_modules\
  // ffprobe-static\bin\win32\x64\ffprobe.exe" and failed with ENOENT,
  // silently falling back to "probe unavailable, leave as-is" — the
  // normalization decision never actually ran). Added the moment this
  // codebase's first ffprobe caller (ffprobe-exec.ts) was introduced.
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static", "playwright"],
  // Fix (2026-07-20) — `serverExternalPackages` alone does NOT guarantee a
  // package's actual binary gets copied into `.next/standalone` — that's a
  // SEPARATE step (file tracing, @vercel/nft) that only includes a file if
  // its require()/path-join can be resolved STATICALLY. ffprobe-static's own
  // path.join(__dirname, 'bin', platform, arch, 'ffprobe.exe') uses a plain
  // string literal for the final segment, so the tracer finds it fine.
  // ffmpeg-static's path.join(__dirname, executableBaseName + '.exe') builds
  // that same final segment from a `require('./package.json')` field — not
  // statically resolvable — so the tracer silently omits ffmpeg.exe (a real,
  // live incident: confirmed the binary was completely missing from a fresh
  // standalone build, causing every real transcode to fail with a hard
  // `spawn ... ffmpeg-static\ffmpeg.exe ENOENT`, exactly the founder's real
  // repeat-upload-failure symptom, not a codec/transport issue). The
  // existing serverExternalPackages entry above is still necessary (keeps
  // ffmpeg-static's require() un-bundled, so __dirname stays real at
  // runtime) but was never sufficient on its own — this explicitly forces
  // the binary into every standalone build regardless of the tracer's own
  // static-analysis limits.
  outputFileTracingIncludes: {
    // Wildcarded, not just ".exe" — this app runs on Windows locally today
    // but a real cloud deploy is Linux, where the binary is named "ffmpeg"
    // with no extension; this covers both without needing a platform check.
    "/**/*": ["./node_modules/ffmpeg-static/ffmpeg*"],
  },
  // Module 10 — `next dev`'s floating dev-tools button is `position: fixed`
  // on the viewport. The render-mode page's viewport is deliberately sized
  // to exactly match the export's pixel dimensions (no chrome around the
  // stage), so that fixed-position button sits directly over the captured
  // area and Playwright's element screenshot (which clips to the element's
  // bounding box in viewport space) bakes it into every frame. Never
  // present under `next build`/`next start` (production), but disabling it
  // outright removes the gotcha for anyone who exports against a dev
  // server (e.g. local testing, a dev-mode staging environment).
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
