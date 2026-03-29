import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminOrSuperuser, isSuperuser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['ADMIN', 'DRIVER', 'SUPERUSER']).optional(),
  isActive: z.boolean().optional(),
  adminPhone: z.string().optional(),
  adminEmail: z.string().email().optional(),
});

// PUT /api/admin/users/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!isAdminOrSuperuser(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, role: true },
  });
  if (!existingUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (existingUser.role === 'SUPERUSER' && !isSuperuser(session)) {
    return NextResponse.json(
      { error: 'Only superusers can edit superusers' },
      { status: 403 }
    );
  }

  if (parsed.data.role === 'SUPERUSER' && !isSuperuser(session)) {
    return NextResponse.json(
      { error: 'Only superusers can assign superuser role' },
      { status: 403 }
    );
  }

  const data: z.infer<typeof updateUserSchema> & { password?: string } = { ...parsed.data };
  if (data.password) {
    data.password = await bcrypt.hash(data.password, 10);
  }

  try {
    const user = await prisma.user.update({
      where: { id: params.id },
      data,
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
    });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
}

// DELETE /api/admin/users/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!isAdminOrSuperuser(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, role: true },
  });
  if (!existingUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (session!.user.id === params.id) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 403 });
  }

  if (existingUser.role === 'SUPERUSER' && !isSuperuser(session)) {
    return NextResponse.json(
      { error: 'Only superusers can delete superusers' },
      { status: 403 }
    );
  }

  try {
    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
}
