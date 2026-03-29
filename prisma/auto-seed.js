const { PrismaClient } = require('@prisma/client');
const { seedDatabase, prisma: seedPrisma } = require('./seed-runtime');

const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();

  if (userCount > 0) {
    console.log(`Skipping first-start seed. Found ${userCount} existing user(s).`);
    return;
  }

  console.log('No users found. Running first-start seed...');
  await seedDatabase();
  console.log('First-start seed completed.');
}

main()
  .catch((error) => {
    console.error('Auto-seed check failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await seedPrisma.$disconnect();
    await prisma.$disconnect();
  });
