import { Injectable } from '@nestjs/common';
import { FinanceType, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export interface FinanceCategoryDto {
  label: string;
  value: string;
  type: FinanceType;
  affectType?: string[];
  subcategories?: Array<{ label: string; value: string }>;
}

/**
 * Default categories shipped with every store. The spec wants these merged into
 * the GET response alongside any per-store custom categories.
 */
const DEFAULT_CATEGORIES: Array<FinanceCategoryDto & { isCustom: boolean }> = [
  {
    label: 'Service Payments',
    value: 'service_payment',
    type: FinanceType.INCOME,
    affectType: ['profit'],
    subcategories: [
      { label: 'Advanced Payment', value: 'advanced_payment' },
      { label: 'Additional Payment', value: 'additional_payment' },
      { label: 'Final Payment', value: 'final_payment' },
    ],
    isCustom: false,
  },
  {
    label: 'Cash In',
    value: 'cash_in',
    type: FinanceType.INCOME,
    affectType: ['cash'],
    subcategories: [
      { label: 'Owner Investment', value: 'owner_investment' },
      { label: 'Loan Received', value: 'loan_received' },
    ],
    isCustom: false,
  },
  {
    label: 'Cash Out',
    value: 'cash_out',
    type: FinanceType.EXPENSE,
    affectType: ['cash'],
    subcategories: [
      { label: 'Owner Withdrawal', value: 'owner_withdrawal' },
      { label: 'Loan Repayment', value: 'loan_repayment' },
    ],
    isCustom: false,
  },
  {
    label: 'Operating Expenses',
    value: 'operating_expenses',
    type: FinanceType.EXPENSE,
    affectType: ['profit'],
    subcategories: [
      { label: 'Rent', value: 'rent' },
      { label: 'Utilities', value: 'utilities' },
      { label: 'Salaries', value: 'salaries' },
    ],
    isCustom: false,
  },
  {
    label: 'Business Expenses',
    value: 'business_expenses',
    type: FinanceType.EXPENSE,
    affectType: ['profit'],
    subcategories: [
      { label: 'Inventory', value: 'inventory' },
      { label: 'Parts', value: 'parts' },
    ],
    isCustom: false,
  },
];

@Injectable()
export class FinanceCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(storeId: string, filters: { type?: FinanceType; affectType?: string }) {
    const where: Prisma.FinanceCategoryWhereInput = {
      storeId,
      deletedAt: null,
      ...(filters.type && { type: filters.type }),
      ...(filters.affectType && { affectType: { has: filters.affectType } }),
    };
    const custom = await this.prisma.financeCategory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const defaults = DEFAULT_CATEGORIES.filter((c) => {
      if (filters.type && c.type !== filters.type) return false;
      if (filters.affectType && !(c.affectType ?? []).includes(filters.affectType)) return false;
      return true;
    });

    return {
      defaults,
      custom,
    };
  }

  async create(storeId: string, dto: FinanceCategoryDto) {
    const created = await this.prisma.financeCategory.create({
      data: {
        storeId,
        label: dto.label,
        value: dto.value,
        type: dto.type,
        affectType: dto.affectType ?? [],
        subcategories: (dto.subcategories ?? []) as any,
        isCustom: true,
      },
    });
    return { message: 'Category created', data: created };
  }

  async remove(storeId: string, id: string) {
    await this.prisma.financeCategory.updateMany({
      where: { id, storeId },
      data: { deletedAt: new Date() },
    });
    return { message: 'Category removed', data: { id } };
  }
}
