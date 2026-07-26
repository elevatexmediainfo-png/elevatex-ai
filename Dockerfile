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
COPY --from=builder /app/prisma ./prisma
# prisma.config.ts (2026-07-26 fix) — a ROOT-LEVEL file, a sibling of
# package.json, NOT part of the /app/prisma directory copied above. Prisma 7
# moved the datasource connection string out of schema.prisma entirely
# (this project's datasource db {} block has no `url` field at all — see
# schema.prisma) and into this file's `datasource: { url: env("DATABASE_URL") } }`.
# It was never copied into the runner stage by any COPY line here, and
# .next/standalone's tracer has no reason to include it either — the
# Next.js app itself never imports it; only the separate Prisma CLI process
# does. Reproduced locally: temporarily removing just this file (env()'s own
# implementation and DATABASE_URL both left untouched) produces the exact
# reported error verbatim — "Error: The datasource.url property is required
# in your Prisma config file when using prisma migrate status." — proving
# the file's absence, not env resolution, was the cause.
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Full node_modules copy (2026-07-26 fix — supersedes selectively copying
# node_modules/prisma + node_modules/@prisma + node_modules/playwright* by
# name). Two real, separate incidents proved per-package copying doesn't
# work for Prisma 7's CLI: (1) node_modules/.bin/prisma is a symlink Docker's
# COPY dereferences into a broken relocated file when copied individually —
# fixed by invoking the real entry file directly instead (see CMD below);
# (2) Prisma 7's CLI depends on @prisma/config, which depends on c12,
# deepmerge-ts, effect, and empathic — effect itself depends on fast-check —
# and npm hoists ALL FIVE of those to the true root node_modules/, entirely
# outside both the node_modules/prisma and node_modules/@prisma trees
# (confirmed by inspecting effect's and @prisma/config's own package.json
# dependencies, and by locating each package's actual installed path).
# Enumerating that transitive closure by hand is exactly what caused both
# incidents — every Prisma minor version can add another dependency outside
# @prisma/ scope with no reliable way to predict which. `.next/standalone`'s
# own node_modules (copied above) is Next's file-tracing output for the
# APP's runtime code only; it was never meant to, and doesn't, cover the
# separate CLI tool's dependency graph. Copying the builder stage's complete
# node_modules here (already produced by a real `npm ci` against
# package-lock.json — nothing is installed inside this image) guarantees
# every current and future transitive dependency the CLI needs is present,
# permanently closing this class of bug rather than patching it one missing
# package at a time.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Build-time tripwires — fail the BUILD loudly, not the container at boot.
# The version check exercises the CLI's module-resolution chain (prisma ->
# @prisma/config -> effect -> fast-check, plus c12/deepmerge-ts/empathic/
# dotenv) without a live database — but it does NOT validate datasource.url
# (confirmed: `--version` and `validate` both succeed even with
# prisma.config.ts entirely missing, since neither needs a connection
# string). That's exactly why the explicit `test -f ./prisma.config.ts`
# check above exists as its own separate assertion — `migrate deploy` is the
# only command that actually requires datasource.url to resolve, and it
# can't be run here since there's no live database at build time.
RUN test -f ./prisma.config.ts || \
  (echo "FATAL: prisma.config.ts missing after COPY — migrate deploy has no datasource.url source (schema.prisma intentionally has none)." && exit 1)
RUN test -f ./node_modules/prisma/build/prisma_schema_build_bg.wasm || \
  (echo "FATAL: node_modules/prisma/build/prisma_schema_build_bg.wasm missing after COPY." && exit 1)
RUN test -f ./node_modules/playwright-core/browsers.json || \
  (echo "FATAL: node_modules/playwright-core/browsers.json missing after COPY." && exit 1)
RUN node node_modules/prisma/build/index.js --version || \
  (echo "FATAL: Prisma CLI failed to load its full module graph in the runtime image." && exit 1)

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
# PORT intentionally not hardcoded here — Railway injects its own PORT at
# runtime and this app's server.js reads process.env.PORT directly; a
# hardcoded ENV PORT=3000 in the image is unnecessary and was deliberately
# removed previously.
# Migrations run on every container start (a no-op when nothing's pending) —
# invokes Prisma's real entry file directly, NOT node_modules/.bin/prisma
# (see the COPY comment above for why that shim is unsafe in this image).
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
