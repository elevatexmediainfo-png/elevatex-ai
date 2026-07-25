# Elevatex AI — production image. Three stages: install deps, build (incl.
# Prisma client generation), then a minimal runtime copying only the
# Next.js standalone output. No Prisma binary-engine workarounds needed —
# this app connects via @prisma/adapter-pg (the `pg` driver), a plain JS
# dependency, not Prisma's native query-engine binary.
#
# Debian slim, not Alpine (2026-07-25 fix) — the video editor's export
# renderer drives real Chromium via Playwright (src/lib/video-editor/
# export-worker.ts), and Playwright's bundled Chromium build does not run on
# Alpine/musl libc at all: `playwright install --with-deps` shells out to
# `apt-get` to install Chromium's required OS libraries, which doesn't exist
# on Alpine (apk), and the downloaded browser binary itself is linked against
# glibc. All three stages use the same Debian base so `npm ci` in `deps`
# resolves the matching glibc build of every native-binding package (e.g.
# `sharp` ships separate glibc/musl prebuilts) — mixing bases would silently
# install the wrong variant into the final image.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL isn't needed at build time (Prisma 7's generator reads only
# the schema, not a live connection) but prisma.config.ts/env validation
# expect *some* value to be present when modules load during the build.
ENV DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder"
ENV AUTH_SECRET="placeholder-build-time-secret-not-used-at-runtime"
RUN npx prisma generate
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Keeps the downloaded Chromium build inside node_modules/playwright-core
# (playwright's own documented pattern for bundling browsers with a deploy)
# instead of a separate top-level cache dir — one less path to remember to
# chown/copy correctly.
ENV PLAYWRIGHT_BROWSERS_PATH=0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Migrations run at container startup (see docker-compose.yml's command),
# not at build time — they need a live DATABASE_URL, which the build stage
# only has a placeholder for.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Playwright must be a full, explicit directory copy here — not left to
# `.next/standalone`'s own file-tracing. Next's tracer (@vercel/nft) only
# copies files it can statically resolve via require()/path.join with
# literal segments; playwright-core resolves several of its own supporting
# files (browsers.json among them) dynamically, so a standalone-only build
# silently drops them — exactly the same class of bug already hit with
# ffmpeg-static's binary (see next.config.ts's outputFileTracingIncludes
# comment). Copying the whole package from the builder stage sidesteps the
# tracer entirely, the same fix already applied to prisma above.
COPY --from=builder /app/node_modules/playwright ./node_modules/playwright
COPY --from=builder /app/node_modules/playwright-core ./node_modules/playwright-core

# Build-time tripwire (2026-07-25) — a previous deploy shipped without this
# file present at runtime despite this exact COPY line existing, which
# turned out to be a broken assumption about which build path Railway was
# actually running, not this Dockerfile itself. Fail the BUILD loudly here
# instead of finding out at container boot: if this file is genuinely
# missing right after the COPY above, every later step (install, chown) is
# working with a broken source anyway.
RUN test -f ./node_modules/playwright-core/browsers.json || \
  (echo "FATAL: node_modules/playwright-core/browsers.json missing immediately after COPY — the builder stage's node_modules is incomplete, or this Dockerfile isn't the one actually being built. Aborting build." && exit 1)

# Installs Chromium (only — not the other Playwright browsers this app never
# uses, to keep the image reasonably sized) directly into THIS final image.
# Must run here, not in the builder stage: builder's filesystem is discarded
# except for the specific files the COPY lines above pull out of it, so a
# builder-stage-only install would never make it into what actually ships.
# --with-deps additionally apt-get-installs the shared libraries (fonts,
# libnss3, libatk, etc.) Chromium needs to actually launch — this is the
# step that requires a Debian base (see top-of-file note).
RUN npx playwright install --with-deps chromium \
  && test -f ./node_modules/playwright-core/browsers.json \
  && chown -R nextjs:nodejs ./node_modules/playwright-core

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
