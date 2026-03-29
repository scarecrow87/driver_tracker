import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminOrSuperuser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { geocodeAddress } from '@/lib/geocode';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

// PUT /api/locations/[id] – update a location (admin only)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!isAdminOrSuperuser(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updateData: Record<string, unknown> = { ...parsed.data };

    const hasManualCoords = 'latitude' in parsed.data || 'longitude' in parsed.data;

    if ('address' in parsed.data && !hasManualCoords) {
      if (parsed.data.address) {
        const coords = await geocodeAddress(parsed.data.address);
        if (coords) {
          updateData.latitude = coords.latitude;
          updateData.longitude = coords.longitude;
        }
      } else {
        updateData.latitude = null;
        updateData.longitude = null;
      }
    }

    const location = await prisma.location.update({
      where: { id: params.id },
      data: updateData,
    });
    return NextResponse.json(location);
  } catch {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 });
  }
}

// DELETE /api/locations/[id] – delete a location (admin only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!isAdminOrSuperuser(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await prisma.location.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 });
  }
}
