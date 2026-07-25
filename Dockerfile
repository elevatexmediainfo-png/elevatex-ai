# Elevatex AI — production image. Three stages: install deps, build (incl.
# Prisma client generation), then a minimal runtime copying only the
# Next.js standalone output. No Prisma binary-engine workarounds needed —
# this app connects via @prisma/adapter-pg (the `pg` driver), a plain JS
# dependency, not Prisma's native query-engine binary.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
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

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
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

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
