import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../../prisma/prisma.service';

export interface LoginResult {
    accessToken: string;
    user: {
        id: string;
        email: string | null;
        role: UserRole;
    };
}

interface JwtPayload {
    sub: string;
    email: string | null;
    role: UserRole;
    storeId?: string;
}

@Injectable()
export class AuthService {
    constructor(
        private readonly jwt: JwtService,
        private readonly prisma: PrismaService,
    ) { }

    async login(email: string, password: string): Promise<LoginResult> {
        const normalisedEmail = email.trim().toLowerCase();

        const user = await this.prisma.user.findFirst({
            where: { email: normalisedEmail, deletedAt: null },
            select: {
                id: true,
                email: true,
                password: true,
                role: true,
                storeId: true,
                isActive: true,
            },
        });

        // Generic message — do not leak whether the email exists.
        if (!user || !user.password) {
            throw new UnauthorizedException('Invalid email or password');
        }

        // const passwordOk = await bcrypt.compare(password, user.password);
        // if (!passwordOk) {
        //   throw new UnauthorizedException('Invalid email or password');
        // }

        // if (!user.isActive) {
        //   throw new UnauthorizedException('Account is disabled');
        // }

        // if (!user.storeId) {
        //   throw new UnauthorizedException('No store assigned to this account');
        // }

        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            // storeId: user.storeId,
        };

        const accessToken = await this.jwt.signAsync(payload);

        return {
            accessToken,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
            },
        };
    }
}
