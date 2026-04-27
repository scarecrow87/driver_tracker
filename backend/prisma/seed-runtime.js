const { PrismaClient, Role } = require('@prisma/client');

const prisma = new PrismaClient();

// Precomputed bcrypt hashes for the default passwords:
// super123, admin123, driver123
const DEFAULT_PASSWORD_HASHES = {
  superuser: '$2a$10$/k8HY/D9xCzdGclSTFRc9uG3Iw6OdFreMpc1MM9FYkilj4iiGawoW',
  admin: '$2a$10$BBvo2CR3JCwWQ48BJKF9ZeoweIqkh/ZwqWy190du6hC6QFjss5NIa',
  driver: '$2a$10$clZS0.TajBdJfBj0GFMSJOzztq1.gU2ugQ59noEBfq7mEYU5go8ta',
};

async function seedDatabase() {
  const superuser = await prisma.user.upsert({
    where: { email: 'superuser@example.com' },
    update: {},
    create: {
      email: 'superuser@example.com',
      name: 'Superuser',
      role: Role.SUPERUSER,
      password: DEFAULT_PASSWORD_HASHES.superuser,
      adminPhone: '+1234567899',
      adminEmail: 'superuser@example.com',
      isActive: true,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      role: Role.ADMIN,
      password: DEFAULT_PASSWORD_HASHES.admin,
      adminPhone: '+1234567890',
      adminEmail: 'admin@example.com',
      isActive: true,
    },
  });

  const driver = await prisma.user.upsert({
    where: { email: 'driver@example.com' },
    update: {},
    create: {
      email: 'driver@example.com',
      name: 'Test Driver',
      role: Role.DRIVER,
      password: DEFAULT_PASSWORD_HASHES.driver,
      isActive: true,
    },
  });

  const location1 = await prisma.location.upsert({
    where: { id: 'loc-warehouse' },
    update: {},
    create: {
      id: 'loc-warehouse',
      name: 'Main Warehouse',
      address: '123 Warehouse St, City, ST 12345',
      isActive: true,
    },
  });

  const location2 = await prisma.location.upsert({
    where: { id: 'loc-depot' },
    update: {},
    create: {
      id: 'loc-depot',
      name: 'Downtown Depot',
      address: '456 Main Ave, City, ST 12345',
      isActive: true,
    },
  });

  return { superuser, admin, driver, location1, location2 };
}

async function runSeed() {
  const result = await seedDatabase();
  console.log('Seeded defaults:', {
    superuser: result.superuser.email,
    admin: result.admin.email,
    driver: result.driver.email,
    locations: [result.location1.id, result.location2.id],
  });
}

if (require.main === module) {
  runSeed()
    .catch((error) => {
      console.error('Runtime seeding failed:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { seedDatabase, prisma };
