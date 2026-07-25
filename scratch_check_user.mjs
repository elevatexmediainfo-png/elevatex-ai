import { config } from "dotenv";
config({ path: ".env.local" });
const { prisma } = await import("./src/lib/prisma.ts");
const user = await prisma.user.findUnique({
  where: { phone: "+918234902386" },
  select: { id: true, phone: true, role: true, accountStatus: true, name: true, email: true },
});
console.log("user:", JSON.stringify(user, null, 2));

const hits = await prisma.rateLimitHit.findMany({
  where: { key: { contains: "8234902386" } },
  orderBy: { createdAt: "desc" },
  take: 10,
});
console.log("rate limit hits for this phone:", JSON.stringify(hits, null, 2));
await prisma.$disconnect();
