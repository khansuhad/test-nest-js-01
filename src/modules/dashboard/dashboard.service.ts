import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FinanceType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CacheKeys } from '../../common/utils/cache-keys';
import { decimalToNumber } from '../../common/utils/decimal';
import { FinanceService } from '../finance/finance.service';

export interface DashboardOverview {
  storeId: string;
  kpis: {
    totalIncome: number;
    totalExpense: number;
    netProfit: number;
    transactionCount: number;
    customerCount: number;
    serviceCount: number;
    activeUsers: number;
  };
  last7Days: Array<{ date: string; income: number; expense: number }>;
  recentTransactions: Array<{
    id: string;
    type: FinanceType;
    amount: number;
    category: string | null;
    occurredAt: Date;
  }>;
  generatedAt: string;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly finance: FinanceService,
  ) {}

  async overview(storeId: string): Promise<DashboardOverview> {
    const ttl = this.config.get<number>('cacheTtl.dashboard') ?? 60;
    return this.redis.wrap(CacheKeys.dashboard(storeId), ttl, async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);

      const [summary, customerCount, serviceCount, activeUsers, recent, last7] =
        await Promise.all([
          this.finance.summary(storeId),
          this.prisma.customer.count({ where: { storeId, deletedAt: null } }),
          this.prisma.service.count({ where: { storeId, deletedAt: null, isActive: true } }),
          this.prisma.user.count({ where: { storeId, deletedAt: null, isActive: true } }),
          this.prisma.finance.findMany({
            where: { storeId, deletedAt: null },
            orderBy: { occurredAt: 'desc' },
            take: 10,
            select: {
              id: true,
              type: true,
              amount: true,
              category: true,
              occurredAt: true,
            },
          }),
          this.queryLast7Days(storeId, since),
        ]);

      return {
        storeId,
        kpis: {
          totalIncome: summary.totalIncome,
          totalExpense: summary.totalExpense,
          netProfit: summary.netProfit,
          transactionCount: summary.transactionCount,
          customerCount,
          serviceCount,
          activeUsers,
        },
        last7Days: last7,
        recentTransactions: recent.map((r) => ({
          id: r.id,
          type: r.type,
          amount: decimalToNumber(r.amount),
          category: r.category,
          occurredAt: r.occurredAt,
        })),
        generatedAt: new Date().toISOString(),
      };
    });
  }

  private async queryLast7Days(storeId: string, since: Date) {
    // Single grouped scan, in-memory pivot. Indexed on (storeId, occurredAt).
    const rows = await this.prisma.finance.findMany({
      where: { storeId, deletedAt: null, occurredAt: { gte: since } },
      select: { type: true, amount: true, occurredAt: true },
    });

    const buckets = new Map<string, { income: number; expense: number }>();
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      buckets.set(d.toISOString().slice(0, 10), { income: 0, expense: 0 });
    }
    for (const r of rows) {
      const key = r.occurredAt.toISOString().slice(0, 10);
      const b = buckets.get(key);
      if (!b) continue;
      const n = decimalToNumber(r.amount);
      if (r.type === FinanceType.INCOME) b.income += n;
      else b.expense += n;
    }
    return [...buckets.entries()]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
