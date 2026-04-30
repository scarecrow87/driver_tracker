import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { CheckinService } from './checkin.service';
import { CreateCheckinDto } from './dto/create-checkin.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DriverGuard } from '../auth/guards/driver.guard';
import type { Request } from 'express';
import { User } from '@prisma/client';

@Controller('checkin')
@UseGuards(JwtAuthGuard, DriverGuard)
export class CheckinController {
  constructor(private checkinService: CheckinService) {}

  @Post()
  async createCheckin(@Req() req: Request, @Body() dto: CreateCheckinDto) {
    const user = req['user'] as User;
    return this.checkinService.createCheckin(user, dto);
  }

  @Get()
  async getCurrentCheckin(@Req() req: Request) {
    const user = req['user'] as User;
    return this.checkinService.getCurrentCheckin(user);
  }
}