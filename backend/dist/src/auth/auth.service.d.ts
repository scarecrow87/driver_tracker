import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { User } from '@prisma/client';
import { LoginDto } from './dto/login.dto';
import type { Response } from 'express';
export declare class AuthService {
    private prisma;
    private jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    validateUser(email: string, password: string): Promise<Omit<User, 'password'> | null>;
    login(loginDto: LoginDto, response: Response): Promise<{
        message: string;
    }>;
    logout(response: Response): {
        message: string;
    };
}
