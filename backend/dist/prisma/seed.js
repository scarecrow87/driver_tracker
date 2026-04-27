"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    const superuserPassword = await bcryptjs_1.default.hash('super123', 10);
    const superuser = await prisma.user.upsert({
        where: { email: 'superuser@example.com' },
        update: {},
        create: {
            email: 'superuser@example.com',
            name: 'Superuser',
            role: client_1.Role.SUPERUSER,
            password: superuserPassword,
            adminPhone: '+1234567899',
            adminEmail: 'superuser@example.com',
        },
    });
    const adminPassword = await bcryptjs_1.default.hash('admin123', 10);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@example.com' },
        update: {},
        create: {
            email: 'admin@example.com',
            name: 'Admin User',
            role: client_1.Role.ADMIN,
            password: adminPassword,
            adminPhone: '+1234567890',
            adminEmail: 'admin@example.com',
        },
    });
    const driverPassword = await bcryptjs_1.default.hash('driver123', 10);
    const driver = await prisma.user.upsert({
        where: { email: 'driver@example.com' },
        update: {},
        create: {
            email: 'driver@example.com',
            name: 'Test Driver',
            role: client_1.Role.DRIVER,
            password: driverPassword,
        },
    });
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
//# sourceMappingURL=seed.js.map