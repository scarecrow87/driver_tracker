import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { HealthController } from './modules/health/health.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [HealthController],
  providers: [PrismaService],
})
export class AppModule {}
