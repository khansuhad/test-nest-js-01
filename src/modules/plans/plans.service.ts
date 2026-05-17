import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: 'asc' },
    });
  }

  async statusForStore(storeId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { storeId },
      include: { plan: true },
    });
    if (!subscription) throw new NotFoundException('No active subscription');

    const since = new Date();
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const [customerCount, jobsThisMonth] = await this.prisma.$transaction([
      this.prisma.customer.count({ where: { storeId, deletedAt: null } }),
      this.prisma.service.count({ where: { storeId, deletedAt: null, createdAt: { gte: since } } }),
    ]);

    return {
      subscription,
      usage: {
        customers: { current: customerCount, limit: subscription.plan.maxCustomers },
        jobsThisMonth: { current: jobsThisMonth, limit: subscription.plan.maxJobsPerMonth },
      },
    };
  }
}
