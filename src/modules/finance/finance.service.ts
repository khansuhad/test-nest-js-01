import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FinanceType, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CacheKeys } from '../../common/utils/cache-keys';
import { decimalToNumber } from '../../common/utils/decimal';
import { generatePublicId } from '../../common/utils/public-id';
import { AuthUser } from '../../common/types/auth-user';
import { buildPage } from '../../common/utils/pagination';
import { CreateFinanceDto } from './dto/create-finance.dto';
import { ListFinancesDto } from './dto/list-finances.dto';

export interface FinanceSummary {
  storeId: string;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  transactionCount: number;
  byCategory: Array<{ category: string; type: FinanceType; total: number }>;
  generatedAt: string;
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Generic ledger list with filters.
   * `affectFilter` lets callers (general-finances vs expenses) narrow to a tag.
   */
  async list(
    storeId: string,
    q: ListFinancesDto,
    extra: { affectFilter?: 'cash' | 'profit' } = {},
  ) {
    const where: Prisma.FinanceWhereInput = {
      storeId,
      deletedAt: null,
      ...(q.type && { type: q.type }),
      ...(q.category && { category: q.category }),
      ...((q.from || q.to) && {
        date: {
          ...(q.from && { gte: new Date(q.from) }),
          ...(q.to && { lte: new Date(q.to) }),
        },
      }),
      ...(extra.affectFilter && { affectType: { has: extra.affectFilter } }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.finance.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: q.skip,
        take: q.take,
        include: {
          customer: { select: { id: true, name: true } },
          service: { select: { id: true, name: true, publicId: true } },
        },
      }),
      this.prisma.finance.count({ where }),
    ]);

    return buildPage(rows, total, q);
  }

  async getById(storeId: string, id: string) {
    const row = await this.prisma.finance.findFirst({
      where: {
        storeId,
        deletedAt: null,
        OR: [{ id }, { publicId: id }],
      },
    });
    if (!row) throw new NotFoundException('Finance entry not found');
    return row;
  }

  async create(dto: CreateFinanceDto, user: AuthUser) {
    const row = await this.createWithRetry(dto, user);
    await this.invalidateCaches(user.storeId);
    return {
      message: 'Finance transaction created',
      data: { invoiceId: row.publicId, transaction: row },
    };
  }

  async softDelete(storeId: string, id: string) {
    const existing = await this.getById(storeId, id);
    await this.prisma.finance.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
    await this.invalidateCaches(storeId);
    return { message: 'Finance transaction deleted', data: { id: existing.id } };
  }

  /**
   * Cash balance = sum(income amounts) − sum(expense amounts) over rows tagged with
   * affectType "cash" or "profit" on the income side, minus all expenses.
   */
  async cashBalance(storeId: string) {
    const where: Prisma.FinanceWhereInput = { storeId, deletedAt: null };

    const [income, expense] = await this.prisma.$transaction([
      this.prisma.finance.aggregate({
        where: { ...where, type: FinanceType.INCOME },
        _sum: { amount: true },
      }),
      this.prisma.finance.aggregate({
        where: { ...where, type: FinanceType.EXPENSE },
        _sum: { amount: true },
      }),
    ]);

    const totalIncome = decimalToNumber(income._sum?.amount);
    const totalExpense = decimalToNumber(expense._sum?.amount);

    return {
      storeId,
      totalIncome,
      totalExpense,
      cashInHand: totalIncome - totalExpense,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Aggregated finance summary. Heavy — Redis-cached.
   */
  async summary(storeId: string): Promise<FinanceSummary> {
    const ttl = this.config.get<number>('cacheTtl.financeSummary') ?? 120;
    return this.redis.wrap(CacheKeys.financeSummary(storeId), ttl, async () => {
      const where: Prisma.FinanceWhereInput = { storeId, deletedAt: null };

      const [grouped, count, byCat] = await this.prisma.$transaction([
        this.prisma.finance.groupBy({
          by: ['type'],
          where,
          _sum: { amount: true },
          orderBy: { type: 'asc' },
        }),
        this.prisma.finance.count({ where }),
        this.prisma.finance.groupBy({
          by: ['category', 'type'],
          where: { ...where, category: { not: null } },
          _sum: { amount: true },
          orderBy: [{ category: 'asc' }, { type: 'asc' }],
        }),
      ]);

      const totalsByType = new Map<FinanceType, number>();
      for (const row of grouped) {
        totalsByType.set(row.type, decimalToNumber(row._sum?.amount));
      }

      const totalIncome = totalsByType.get(FinanceType.INCOME) ?? 0;
      const totalExpense = totalsByType.get(FinanceType.EXPENSE) ?? 0;

      const byCategory = byCat.map((c) => ({
        category: c.category ?? '(uncategorized)',
        type: c.type,
        total: decimalToNumber(c._sum?.amount),
      }));

      return {
        storeId,
        totalIncome,
        totalExpense,
        netProfit: totalIncome - totalExpense,
        transactionCount: count,
        byCategory,
        generatedAt: new Date().toISOString(),
      };
    });
  }

  /**
   * Aggregate the payments tied to a specific service id.
   * Used by the spec's /services/service-payments?serviceId= endpoint.
   */
  async paymentsForService(storeId: string, serviceId: string) {
    return this.prisma.finance.findMany({
      where: { storeId, serviceId, deletedAt: null },
      orderBy: { date: 'desc' },
    });
  }

  private async invalidateCaches(storeId: string) {
    await Promise.all([
      this.redis.del(CacheKeys.financeSummary(storeId)),
      this.redis.del(CacheKeys.dashboard(storeId)),
    ]);
  }

  private normaliseAffectType(input: string | string[] | undefined): string[] {
    if (!input) return [];
    if (Array.isArray(input)) return input;
    return [input];
  }

  private async createWithRetry(dto: CreateFinanceDto, user: AuthUser, attempt = 0): Promise<any> {
    try {
      const occurredAt = dto.date ? new Date(dto.date)
        : dto.occurredAt ? new Date(dto.occurredAt)
        : new Date();
      return await this.prisma.finance.create({
        data: {
          publicId: generatePublicId(),
          storeId: user.storeId,
          type: dto.type,
          amount: new Prisma.Decimal(dto.amount),
          currency: dto.currency ?? 'USD',
          category: dto.category,
          subcategory: dto.subcategory,
          affectType: this.normaliseAffectType(dto.affectType),
          description: dto.description,
          notes: dto.notes,
          date: occurredAt,
          occurredAt,
          customerId: dto.customerId,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          serviceId: dto.serviceId,
          createdBy: user.userId,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        attempt < 3
      ) {
        return this.createWithRetry(dto, user, attempt + 1);
      }
      throw err;
    }
  }
}
