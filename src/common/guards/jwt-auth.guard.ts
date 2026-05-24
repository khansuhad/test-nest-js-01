import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { SubscriptionPlanTier } from '@prisma/client';

import { UserRole, USER_ROLE_VALUES } from '../enums/user-role';
import type { Algorithm } from 'jsonwebtoken';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthUser } from '../types/auth-user';

const SUPPORTED_ALGORITHMS: ReadonlyArray<Algorithm> = [
  'HS256', 'HS384', 'HS512',
  'RS256', 'RS384', 'RS512',
  'ES256', 'ES384', 'ES512',
  'PS256', 'PS384', 'PS512',
];

function resolveAlgorithm(raw: string | undefined): Algorithm {
  const candidate = (raw ?? 'HS256') as Algorithm;
  return SUPPORTED_ALGORITHMS.includes(candidate) ? candidate : 'HS256';
}

interface RawJwtPayload {
  sub?: string;
  userId?: string;
  email?: string;
  mobile?: string;
  role?: string;
  storeId?: string;
  subscriptionPlan?: string;
  iss?: string;
  aud?: string | string[];
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    let payload: RawJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<RawJwtPayload>(token, {
        secret: this.config.get<string>('jwt.secret'),
        algorithms: [resolveAlgorithm(this.config.get<string>('jwt.algorithm'))],
        issuer: this.config.get<string>('jwt.issuer'),
        audience: this.config.get<string>('jwt.audience'),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.debug(`JWT verification failed: ${message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = this.toAuthUser(payload);
    req.user = user;
    return true;
  }

  private extractToken(req: any): string | null {
    const header = req.headers?.authorization;
    if (!header || typeof header !== 'string') return null;
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
    return token.trim();
  }

  private toAuthUser(p: RawJwtPayload): AuthUser {
    const userId = p.userId ?? p.sub;
    if (!userId) throw new UnauthorizedException('Token missing userId/sub');
    if (!p.storeId) throw new UnauthorizedException('Token missing storeId');
    if (!p.role) throw new UnauthorizedException('Token missing role');

    const role = p.role.toUpperCase() as UserRole;
    if (!USER_ROLE_VALUES.includes(role)) {
      throw new UnauthorizedException(`Unknown role: ${p.role}`);
    }

    const planRaw = (p.subscriptionPlan ?? 'FREE').toUpperCase() as SubscriptionPlanTier;
    const subscriptionPlan = Object.values(SubscriptionPlanTier).includes(planRaw)
      ? planRaw
      : SubscriptionPlanTier.FREE;

    return {
      userId,
      email: p.email,
      mobile: p.mobile,
      role,
      storeId: p.storeId,
      subscriptionPlan,
    };
  }
}
