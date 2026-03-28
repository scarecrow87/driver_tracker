import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'DRIVER']).default('DRIVER'),
  adminPhone: z.string().optional(),
  adminEmail: z.string().email().optional(),
});

function isAdmin(session: any) {
  return session?.user?.role === 'ADMIN';
}

// GET /api/admin/users – list all users
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
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
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const hashed = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      ...parsed.data,
      password: hashed,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      adminPhone: true,
      adminEmail: true,
      createdAt: true,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
