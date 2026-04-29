import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminOrSuperuser, isSuperuser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const createUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'DRIVER', 'SUPERUSER']).default('DRIVER'),
  isActive: z.boolean().optional().default(true),
  adminPhone: z.string().optional(),
  adminEmail: z.string().email().optional(),
  driverPhone: z.string().optional(),
});

// GET /api/admin/users – list users
// Superusers see all roles. Admins see only ADMIN and DRIVER accounts.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdminOrSuperuser(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const roleFilter = isSuperuser(session)
    ? undefined
    : { in: [Role.ADMIN, Role.DRIVER] };

  const users = await prisma.user.findMany({
    where: roleFilter ? { role: roleFilter } : undefined,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      adminPhone: true,
      adminEmail: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(users);
}

// POST /api/admin/users – create a user
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdminOrSuperuser(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.role === 'SUPERUSER' && !isSuperuser(session)) {
    return NextResponse.json(
      { error: 'Only superusers can create superusers' },
      { status: 403 }
    );
  }

  const hashed = await bcrypt.hash(parsed.data.password, 10);
  // If role is DRIVER and email is not provided, set to empty string to satisfy Prisma
  const userData = {
    ...parsed.data,
    password: hashed,
    email: parsed.data.role === 'DRIVER' ? (parsed.data.email ?? '') : (parsed.data.email as string),
  };
  const user = await prisma.user.create({
    data: userData,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      adminPhone: true,
      adminEmail: true,
      driverPhone: true,
      createdAt: true,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
