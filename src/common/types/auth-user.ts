import { SubscriptionPlanTier } from '@prisma/client';

import { UserRole } from '../enums/user-role';

export interface AuthUser {
  userId: string;
  email?: string;
  mobile?: string;
  role: UserRole;
  storeId: string;
  subscriptionPlan: SubscriptionPlanTier;
}

export interface AuthRequest extends Express.Request {
  user: AuthUser;
}
