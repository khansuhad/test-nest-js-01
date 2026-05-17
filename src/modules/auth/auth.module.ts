import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { Algorithm } from 'jsonwebtoken';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('jwt.secret');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is not configured');
        }
        const algorithm = (config.get<string>('jwt.algorithm') ?? 'HS256') as Algorithm;
        const expiresIn = config.get<string>('jwt.expiresIn') ?? '7d';
        const issuer = config.get<string>('jwt.issuer');
        const audience = config.get<string>('jwt.audience');

        return {
          secret,
          signOptions: {
            algorithm,
            expiresIn,
            ...(issuer ? { issuer } : {}),
            ...(audience ? { audience } : {}),
          },
          verifyOptions: {
            algorithms: [algorithm],
            ...(issuer ? { issuer } : {}),
            ...(audience ? { audience } : {}),
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
