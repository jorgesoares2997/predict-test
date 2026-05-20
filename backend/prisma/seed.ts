import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const categories = ['Cripto', 'Esportes', 'Política', 'Economia'];

  console.log('🌱 Seeding categories...');

  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log('✅ Categories seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
