import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const markets = await prisma.market.findMany({ select: { title: true, status: true, closing_date: true, liquidate_at: true } });
  console.log(markets);
}
main().finally(() => prisma.$disconnect());
