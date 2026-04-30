import { Test, TestingModule } from '@nestjs/testing';
import { CheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DriverGuard } from '../auth/guards/driver.guard';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';

describe('CheckinController', () => {
  let controller: CheckinController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [CheckinController],
      providers: [
        CheckinService,
        JwtAuthGuard,
        DriverGuard,
        PrismaService,
        JwtService,
      ],
    }).compile();

    controller = module.get<CheckinController>(CheckinController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
