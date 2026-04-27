import { Controller, Get, Put, Body, UseGuards, Req } from '@nestjs/common';
import { NotificationSettingsService } from './notification-settings.service';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperuserGuard } from '../auth/superuser.guard';
import type { Request } from 'express';

@Controller('notification-settings')
@UseGuards(JwtAuthGuard, SuperuserGuard)
export class NotificationSettingsController {
  constructor(private notificationSettingsService: NotificationSettingsService) {}

  @Get()
  async getSettings() {
    return this.notificationSettingsService.getNotificationSettings();
  }

  @Put()
  async updateSettings(@Req() req: Request, @Body() dto: UpdateNotificationSettingsDto) {
    const user = req['user'] as { email: string; sub: string; role: string };
    const updatedById = user.sub;
    return this.notificationSettingsService.upsertNotificationSettings(dto, updatedById);
  }
}