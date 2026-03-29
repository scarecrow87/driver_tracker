import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create superuser account
  const superuserPassword = await bcrypt.hash('super123', 10);
  const superuser = await prisma.user.upsert({
    where: { email: 'superuser@example.com' },
    update: {},
    create: {
      email: 'superuser@example.com',
      name: 'Superuser',
      role: Role.SUPERUSER,
      password: superuserPassword,
      adminPhone: '+1234567899',
      adminEmail: 'superuser@example.com',
    },
  });

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      role: Role.ADMIN,
      password: adminPassword,
      adminPhone: '+1234567890',
      adminEmail: 'admin@example.com',
    },
  });

  // Create a driver user
  const driverPassword = await bcrypt.hash('driver123', 10);
  const driver = await prisma.user.upsert({
    where: { email: 'driver@example.com' },
    update: {},
    create: {
      email: 'driver@example.com',
      name: 'Test Driver',
      role: Role.DRIVER,
      password: driverPassword,
    },
  });

  // Create sample locations
  const location1 = await prisma.location.upsert({
    where: { id: 'loc-warehouse' },
    update: {},
    create: {
      id: 'loc-warehouse',
      name: 'Main Warehouse',
      address: '123 Warehouse St, City, ST 12345',
    },
  });

  const location2 = await prisma.location.upsert({
    where: { id: 'loc-depot' },
    update: {},
    create: {
      id: 'loc-depot',
      name: 'Downtown Depot',
      address: '456 Main Ave, City, ST 12345',
    },
  });

  console.log('Seeded:', { superuser, admin, driver, location1, location2 });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
