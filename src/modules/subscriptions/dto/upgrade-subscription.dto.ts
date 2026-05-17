import { SubscriptionPlanTier } from '@prisma/client';
import { IsEnum, IsIn, IsOptional } from 'class-validator';

export class UpgradeSubscriptionDto {
  @IsEnum(SubscriptionPlanTier)
  tier!: SubscriptionPlanTier;

  @IsOptional()
  @IsIn(['monthly', 'yearly'])
  billingCycle?: 'monthly' | 'yearly';
}
