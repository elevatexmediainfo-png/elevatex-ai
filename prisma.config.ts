import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Plain `dotenv` only auto-loads `.env`, but this project follows Next.js
// convention and keeps local secrets in `.env.local`. Load both, with
// `.env.local` taking precedence, matching Next.js's own resolution order.
config({ path: ".env" });
config({ path: ".env.local", override: true });

// Prisma 7 — connection URL for CLI operations (migrate, studio, etc.).
// Application runtime code uses the @prisma/adapter-pg driver adapter
// directly (see src/lib/prisma.ts), not this file.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
