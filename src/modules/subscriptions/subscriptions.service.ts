import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { UpgradeSubscriptionDto } from './dto/upgrade-subscription.dto';

type ResourceKey = 'maxCustomers' | 'maxJobsPerMonth' | 'maxUsers';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async status(storeId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { storeId },
      include: { plan: true },
    });
    if (!sub) return { storeId, status: 'NONE', plan: null };
    return sub;
  }

  async upgrade(storeId: string, dto: UpgradeSubscriptionDto) {
    const plan = await this.prisma.plan.findUnique({ where: { tier: dto.tier } });
    if (!plan) throw new NotFoundException(`Plan tier ${dto.tier} not found`);

    const cycleDays = dto.billingCycle === 'yearly' ? 365 : 30;
    const currentPeriodEnd = new Date(Date.now() + cycleDays * 24 * 60 * 60 * 1000);

    return this.prisma.subscription.upsert({
      where: { storeId },
      update: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        startedAt: new Date(),
        cancelledAt: null,
        currentPeriodEnd,
      },
      create: {
        storeId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd,
      },
      include: { plan: true },
    });
  }

  async checkLimit(storeId: string, resource: ResourceKey) {
    const sub = await this.prisma.subscription.findUnique({
      where: { storeId },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException('No active subscription');

    let current = 0;
    let limit = 0;

    if (resource === 'maxCustomers') {
      current = await this.prisma.customer.count({ where: { storeId, deletedAt: null } });
      limit = sub.plan.maxCustomers;
    } else if (resource === 'maxJobsPerMonth') {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      current = await this.prisma.service.count({
        where: { storeId, deletedAt: null, createdAt: { gte: start } },
      });
      limit = sub.plan.maxJobsPerMonth;
    } else if (resource === 'maxUsers') {
      current = await this.prisma.user.count({ where: { storeId, deletedAt: null, isActive: true } });
      limit = sub.plan.maxUsers;
    } else {
      throw new BadRequestException(`Unknown resource '${resource}'`);
    }

    return {
      resource,
      allowed: current < limit,
      current,
      limit,
      remaining: Math.max(0, limit - current),
    };
  }
}
