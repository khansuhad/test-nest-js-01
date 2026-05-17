import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthUser } from '../types/auth-user';

/**
 * Hard guarantee that every authenticated request carries a storeId.
 * Also blocks the obvious tampering vector: a client setting `storeId` in the body, params, or query
 * that does NOT match the storeId from the verified JWT.
 *
 * The service layer must still pass `user.storeId` into every query — this guard is defense-in-depth.
 */
@Injectable()
export class StoreIsolationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const user: AuthUser | undefined = req.user;
    if (!user?.storeId) throw new ForbiddenException('Missing tenant context');

    const sources = [req.body, req.params, req.query];
    for (const src of sources) {
      if (src && typeof src === 'object' && 'storeId' in src) {
        const candidate = (src as any).storeId;
        if (candidate && candidate !== user.storeId) {
          throw new ForbiddenException('Cross-store access denied');
        }
      }
    }
    return true;
  }
}
