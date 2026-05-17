import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../types/auth-user';

/**
 * Resolves the active storeId from the verified JWT.
 * Throws ForbiddenException if no storeId is present — multi-tenant code MUST always have one.
 */
export const StoreId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    const user: AuthUser | undefined = req.user;
    if (!user?.storeId) {
      throw new ForbiddenException('Missing storeId on principal');
    }
    return user.storeId;
  },
);
