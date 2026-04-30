import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCheckinDto } from './dto/create-checkin.dto';
import { User } from '@prisma/client';

@Injectable()
export class CheckinService {
  constructor(private prisma: PrismaService) {}

  async createCheckin(user: User, dto: CreateCheckinDto) {
    // Check if user is active
    if (!user.isActive) {
      throw new Error('Driver account is inactive');
    }

    // Check for existing open check-in
    const existingOpenCheckin = await this.prisma.checkIn.findFirst({
      where: {
        driverId: user.id,
        checkOutTime: null,
      },
    });

    if (existingOpenCheckin) {
      throw new ConflictException('You already have an open check-in');
    }

    // Check if idempotency key already used
    if (dto.idempotencyKey) {
      const existingCheckin = await this.prisma.checkIn.findFirst({
        where: {
          driverId: user.id,
          checkInRequestKey: dto.idempotencyKey,
        },
      });

      if (existingCheckin) {
        return existingCheckin;
      }
    }

    // Validate location exists and is active
    const location = await this.prisma.location.findUnique({
      where: { id: dto.locationId },
      select: { id: true, isActive: true },
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    if (!location.isActive) {
      throw new Error('Selected location is inactive');
    }

    // Create check-in
    return this.prisma.checkIn.create({
      data: {
        driverId: user.id,
        locationId: dto.locationId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        checkInRequestKey: dto.idempotencyKey,
        isExtendedStay: dto.extendedStay ?? false,
        extendedStayReason: dto.extendedStay ? dto.extendedStayReason : null,
        extendedStayAt: dto.extendedStay ? new Date() : null,
      },
      include: { location: true },
    });
  }

  async getCurrentCheckin(user: User) {
    return this.prisma.checkIn.findFirst({
      where: {
        driverId: user.id,
        checkOutTime: null,
      },
      include: { location: true },
    });
  }
}