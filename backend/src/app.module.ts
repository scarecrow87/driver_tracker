import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { HealthController } from './modules/health/health.controller';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { NotificationSettingsModule } from './notification-settings/notification-settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    NotificationSettingsModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService],
})
export class AppModule {}
