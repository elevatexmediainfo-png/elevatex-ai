import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { seedDefaults } from "../src/lib/seed-defaults";

config({ path: ".env" });
config({ path: ".env.local", override: true });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const summary = await seedDefaults(prisma);
  console.log(
    `Seeded ${summary.templates} templates, ${summary.creditPackages} credit packages, ${summary.pricingPlans} pricing plans, ${summary.creativeTools} creative tools.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
