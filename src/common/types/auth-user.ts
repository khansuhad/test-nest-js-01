import { UserRole, SubscriptionPlanTier } from '@prisma/client';

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
