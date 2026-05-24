import { Injectable, Logger } from '@nestjs/common';
import {
  FinanceType,
  Prisma,
  ServiceStatus,
  SubscriptionPlanTier,
  SubscriptionStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { UserRole } from '../../common/enums/user-role';

import { PrismaService } from '../../prisma/prisma.service';

const SEED_PASSWORD = 'Test@1234';

export interface SeedSummary {
  plans: number;
  stores: number;
  users: number;
  customers: number;
  services: number;
  finances: number;
  financeCategories: number;
  devices: number;
  subscriptions: number;
}

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(): Promise<SeedSummary> {
    const summary: SeedSummary = {
      plans: 0,
      stores: 0,
      users: 0,
      customers: 0,
      services: 0,
      finances: 0,
      financeCategories: 0,
      devices: 0,
      subscriptions: 0,
    };

    summary.plans = await this.seedPlans();

    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

    // ============================================================
    // STORE A — Test POS Store (PRO, 3 users)
    // ============================================================
    let storeA = await this.upsertStore({
      publicId: '100001',
      name: 'Test POS Store',
      slug: 'test-pos-store',
      email: 'owner@test-pos.com',
      phone: '01700000001',
      currency: 'BDT',
      timezone: 'Asia/Dhaka',
      address: 'Road 1, Dhaka, Bangladesh',
    });
    summary.stores += 1;

    const adminA = await this.upsertUser({
      storeId: storeA.id,
      mobile: '01700000001',
      name: 'Asma Admin',
      email: 'admin@test-pos.com',
      role: UserRole.ADMIN,
      passwordHash,
      publicId: 'U10001',
    });
    const managerA = await this.upsertUser({
      storeId: storeA.id,
      mobile: '01700000002',
      name: 'Manik Manager',
      email: 'manager@test-pos.com',
      role: UserRole.MANAGER,
      passwordHash,
      publicId: 'U10002',
    });
    const cashierA = await this.upsertUser({
      storeId: storeA.id,
      mobile: '01700000003',
      name: 'Karim Cashier',
      email: 'cashier@test-pos.com',
      role: UserRole.CASHIER,
      passwordHash,
      publicId: 'U10003',
    });
    summary.users += 3;

    if (storeA.ownerId !== adminA.id) {
      storeA = await this.prisma.store.update({
        where: { id: storeA.id },
        data: { ownerId: adminA.id },
      });
    }

    await this.upsertSubscription(storeA.id, SubscriptionPlanTier.PRO);
    summary.subscriptions += 1;

    const customersA = [
      { publicId: '200001', name: 'Rahim Khan',    phone: '01911111101', email: 'rahim@example.com',  city: 'Dhaka',     address: 'Mirpur 10',  notes: 'Premium customer' },
      { publicId: '200002', name: 'Sumi Akter',    phone: '01911111102', email: 'sumi@example.com',   city: 'Dhaka',     address: 'Banani 11',  notes: null },
      { publicId: '200003', name: 'Fahim Hossain', phone: '01911111103', email: 'fahim@example.com',  city: 'Chittagong',address: 'GEC',        notes: 'Walk-in' },
      { publicId: '200004', name: 'Nila Sultana',  phone: '01911111104', email: null,                 city: 'Sylhet',    address: 'Zindabazar', notes: null },
      { publicId: '200005', name: 'Tareq Aziz',    phone: '01911111105', email: 'tareq@example.com',  city: 'Dhaka',     address: 'Uttara 7',   notes: 'Bulk client' },
    ];
    for (const c of customersA) {
      await this.prisma.customer.upsert({
        where: { storeId_phone: { storeId: storeA.id, phone: c.phone } },
        update: {},
        create: { ...c, storeId: storeA.id, createdBy: adminA.id },
      });
    }
    summary.customers += customersA.length;

    const servicesA = [
      {
        publicId: '300001', name: 'Display Replacement',
        number: '01911111101', model: 'iPhone 15 Pro', problem: 'Cracked screen',
        status: ServiceStatus.IN_PROGRESS,
        price: 12000, partsCost: 7500, discount: 500, advancedAmount: 2000,
        finalPrice: undefined as number | undefined,
      },
      {
        publicId: '300002', name: 'Battery Replacement',
        number: '01911111102', model: 'Samsung S24 Ultra', problem: 'Battery drains fast',
        status: ServiceStatus.DELIVERED,
        price: 6500, partsCost: 4000, discount: 0, advancedAmount: 6500, finalPrice: 6500,
      },
      {
        publicId: '300003', name: 'Charging Port Repair',
        number: '01911111103', model: 'Pixel 8', problem: 'Not charging',
        status: ServiceStatus.PENDING,
        price: 4500, partsCost: 1500, discount: 0, advancedAmount: 0,
        finalPrice: undefined as number | undefined,
      },
    ];
    for (const s of servicesA) {
      await this.prisma.service.upsert({
        where: { storeId_publicId: { storeId: storeA.id, publicId: s.publicId } },
        update: {},
        create: {
          publicId: s.publicId,
          name: s.name,
          number: s.number,
          model: s.model,
          problem: s.problem,
          status: s.status,
          storeId: storeA.id,
          price: new Prisma.Decimal(s.price),
          partsCost: new Prisma.Decimal(s.partsCost),
          discount: new Prisma.Decimal(s.discount),
          advancedAmount: new Prisma.Decimal(s.advancedAmount),
          finalPrice: s.finalPrice !== undefined ? new Prisma.Decimal(s.finalPrice) : undefined,
        },
      });
    }
    summary.services += servicesA.length;

    await this.prisma.financeCategory.upsert({
      where: { storeId_value: { storeId: storeA.id, value: 'custom_salaries' } },
      update: {},
      create: {
        storeId: storeA.id,
        label: 'Custom Salaries',
        value: 'custom_salaries',
        type: FinanceType.EXPENSE,
        affectType: ['profit'],
        subcategories: [
          { label: 'Full Time', value: 'full_time' },
          { label: 'Part Time', value: 'part_time' },
        ] as any,
      },
    });
    summary.financeCategories += 1;

    const customer1 = await this.prisma.customer.findFirst({
      where: { storeId: storeA.id, phone: '01911111101' },
    });
    const service1 = await this.prisma.service.findFirst({
      where: { storeId: storeA.id, publicId: '300001' },
    });
    const service2 = await this.prisma.service.findFirst({
      where: { storeId: storeA.id, publicId: '300002' },
    });

    const financesA = [
      {
        publicId: '400001', type: FinanceType.INCOME, amount: 2000,
        category: 'service_payment', subcategory: 'advanced_payment', affectType: ['profit'],
        notes: 'Advance for iPhone screen', customerId: customer1?.id, serviceId: service1?.id,
      },
      {
        publicId: '400002', type: FinanceType.INCOME, amount: 6500,
        category: 'service_payment', subcategory: 'final_payment', affectType: ['profit'],
        notes: 'Final payment for Samsung battery', serviceId: service2?.id,
        customerId: undefined as string | undefined,
      },
      {
        publicId: '400003', type: FinanceType.EXPENSE, amount: 5000,
        category: 'operating_expenses', subcategory: 'rent', affectType: ['profit'],
        notes: 'Shop monthly rent',
        customerId: undefined as string | undefined,
        serviceId: undefined as string | undefined,
      },
      {
        publicId: '400004', type: FinanceType.INCOME, amount: 20000,
        category: 'cash_in', subcategory: 'owner_investment', affectType: ['cash'],
        notes: 'Owner topped up working cash',
        customerId: undefined as string | undefined,
        serviceId: undefined as string | undefined,
      },
      {
        publicId: '400005', type: FinanceType.EXPENSE, amount: 3500,
        category: 'cash_out', subcategory: 'owner_withdrawal', affectType: ['cash'],
        notes: 'Owner withdrew cash',
        customerId: undefined as string | undefined,
        serviceId: undefined as string | undefined,
      },
    ];
    for (const f of financesA) {
      await this.prisma.finance.upsert({
        where: { storeId_publicId: { storeId: storeA.id, publicId: f.publicId } },
        update: {},
        create: {
          publicId: f.publicId,
          type: f.type,
          amount: new Prisma.Decimal(f.amount),
          currency: 'BDT',
          category: f.category,
          subcategory: f.subcategory,
          affectType: f.affectType,
          notes: f.notes,
          customerId: f.customerId,
          serviceId: f.serviceId,
          storeId: storeA.id,
          customerName: customer1?.name,
          customerPhone: customer1?.phone ?? undefined,
          createdBy: adminA.id,
        },
      });
    }
    summary.finances += financesA.length;

    await this.prisma.deviceLogin.upsert({
      where: { storeId_deviceId: { storeId: storeA.id, deviceId: 'device-a-trusted' } },
      update: {},
      create: {
        storeId: storeA.id, userId: adminA.id,
        deviceId: 'device-a-trusted',
        deviceToken: '550e8400-e29b-41d4-a716-446655440001',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        ipAddress: '127.0.0.1', isTrusted: true,
      },
    });
    await this.prisma.deviceLogin.upsert({
      where: { storeId_deviceId: { storeId: storeA.id, deviceId: 'device-a-mobile' } },
      update: {},
      create: {
        storeId: storeA.id, userId: cashierA.id,
        deviceId: 'device-a-mobile',
        deviceToken: '550e8400-e29b-41d4-a716-446655440002',
        userAgent: 'Mozilla/5.0 (Linux; Android 14)',
        ipAddress: '192.168.0.42', isTrusted: false,
      },
    });
    summary.devices += 2;

    // suppress unused-variable warning for managerA — kept for parity with seed.ts
    void managerA;

    // ============================================================
    // STORE B — Side Shop (FREE, 1 user)
    // ============================================================
    let storeB = await this.upsertStore({
      publicId: '100002',
      name: 'Side Shop',
      slug: 'side-shop',
      email: 'side@shop.com',
      phone: '01700000010',
      currency: 'BDT',
      timezone: 'Asia/Dhaka',
      address: 'Road 9, Chittagong',
    });
    summary.stores += 1;

    const adminB = await this.upsertUser({
      storeId: storeB.id,
      mobile: '01700000010',
      name: 'Bappi Boss',
      email: 'admin@side-shop.com',
      role: UserRole.ADMIN,
      passwordHash,
      publicId: 'U20001',
    });
    summary.users += 1;

    if (storeB.ownerId !== adminB.id) {
      storeB = await this.prisma.store.update({
        where: { id: storeB.id },
        data: { ownerId: adminB.id },
      });
    }
    await this.upsertSubscription(storeB.id, SubscriptionPlanTier.FREE);
    summary.subscriptions += 1;

    const customersB = [
      { publicId: '210001', name: 'Chittagong Customer 1', phone: '01922222201', city: 'Chittagong' },
      { publicId: '210002', name: 'Chittagong Customer 2', phone: '01922222202', city: 'Chittagong' },
    ];
    for (const c of customersB) {
      await this.prisma.customer.upsert({
        where: { storeId_phone: { storeId: storeB.id, phone: c.phone } },
        update: {},
        create: { ...c, storeId: storeB.id, createdBy: adminB.id },
      });
    }
    summary.customers += customersB.length;

    await this.prisma.service.upsert({
      where: { storeId_publicId: { storeId: storeB.id, publicId: '310001' } },
      update: {},
      create: {
        publicId: '310001', storeId: storeB.id,
        name: 'Speaker Replacement', number: '01922222201', model: 'Redmi Note 13',
        problem: 'No audio', status: ServiceStatus.RECEIVED,
        price: new Prisma.Decimal(2200), partsCost: new Prisma.Decimal(800),
        discount: new Prisma.Decimal(0), advancedAmount: new Prisma.Decimal(500),
      },
    });
    summary.services += 1;

    const financesB = [
      {
        publicId: '410001', type: FinanceType.INCOME, amount: 500,
        category: 'service_payment', subcategory: 'advanced_payment', affectType: ['profit'],
        notes: 'Advance for Redmi speaker',
      },
      {
        publicId: '410002', type: FinanceType.EXPENSE, amount: 1500,
        category: 'operating_expenses', subcategory: 'utilities', affectType: ['profit'],
        notes: 'Electricity bill',
      },
    ];
    for (const f of financesB) {
      await this.prisma.finance.upsert({
        where: { storeId_publicId: { storeId: storeB.id, publicId: f.publicId } },
        update: {},
        create: {
          publicId: f.publicId,
          type: f.type,
          amount: new Prisma.Decimal(f.amount),
          currency: 'BDT',
          category: f.category,
          subcategory: f.subcategory,
          affectType: f.affectType,
          notes: f.notes,
          storeId: storeB.id,
          createdBy: adminB.id,
        },
      });
    }
    summary.finances += financesB.length;

    await this.prisma.deviceLogin.upsert({
      where: { storeId_deviceId: { storeId: storeB.id, deviceId: 'device-b-laptop' } },
      update: {},
      create: {
        storeId: storeB.id, userId: adminB.id,
        deviceId: 'device-b-laptop',
        deviceToken: '550e8400-e29b-41d4-a716-446655440010',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)',
        ipAddress: '10.0.0.5', isTrusted: true,
      },
    });
    summary.devices += 1;

    this.logger.log(`Seed complete: ${JSON.stringify(summary)}`);
    return summary;
  }

  private async seedPlans(): Promise<number> {
    const plans = [
      {
        tier: SubscriptionPlanTier.FREE, name: 'Free',
        priceMonthly: new Prisma.Decimal(0), priceYearly: new Prisma.Decimal(0),
        maxUsers: 1, maxCustomers: 50, maxJobsPerMonth: 25,
        features: { dashboard: true, exports: false, multiUser: false },
      },
      {
        tier: SubscriptionPlanTier.BASIC, name: 'Basic',
        priceMonthly: new Prisma.Decimal(9), priceYearly: new Prisma.Decimal(90),
        maxUsers: 3, maxCustomers: 500, maxJobsPerMonth: 200,
        features: { dashboard: true, exports: true, multiUser: true },
      },
      {
        tier: SubscriptionPlanTier.PRO, name: 'Pro',
        priceMonthly: new Prisma.Decimal(29), priceYearly: new Prisma.Decimal(290),
        maxUsers: 10, maxCustomers: 5000, maxJobsPerMonth: 2000,
        features: { dashboard: true, exports: true, multiUser: true, api: true },
      },
      {
        tier: SubscriptionPlanTier.ENTERPRISE, name: 'Enterprise',
        priceMonthly: new Prisma.Decimal(99), priceYearly: new Prisma.Decimal(990),
        maxUsers: 1000, maxCustomers: 1_000_000, maxJobsPerMonth: 1_000_000,
        features: { dashboard: true, exports: true, multiUser: true, api: true, sso: true },
      },
    ];
    for (const p of plans) {
      await this.prisma.plan.upsert({
        where: { tier: p.tier },
        update: p,
        create: p,
      });
    }
    return plans.length;
  }

  private async upsertStore(args: {
    publicId: string;
    name: string;
    slug: string;
    email: string;
    phone: string;
    currency: string;
    timezone: string;
    address: string;
  }) {
    const existing = await this.prisma.store.findFirst({ where: { publicId: args.publicId } });
    if (existing) return existing;
    return this.prisma.store.create({
      data: {
        publicId: args.publicId,
        name: args.name,
        slug: args.slug,
        ownerId: 'placeholder',
        email: args.email,
        phone: args.phone,
        currency: args.currency,
        timezone: args.timezone,
        address: args.address,
        isActive: true,
        isVerified: true,
      },
    });
  }

  private async upsertUser(args: {
    storeId: string;
    mobile: string;
    name: string;
    email: string;
    role: UserRole;
    passwordHash: string;
    publicId: string;
  }) {
    return this.prisma.user.upsert({
      where: { mobile: args.mobile },
      update: {
        storeId: args.storeId,
        role: args.role,
        isActive: true,
        isVerified: true,
      },
      create: {
        publicId: args.publicId,
        mobile: args.mobile,
        email: args.email,
        name: args.name,
        role: args.role,
        password: args.passwordHash,
        storeId: args.storeId,
        isActive: true,
        isVerified: true,
      },
    });
  }

  private async upsertSubscription(storeId: string, tier: SubscriptionPlanTier) {
    const plan = await this.prisma.plan.findUniqueOrThrow({ where: { tier } });
    return this.prisma.subscription.upsert({
      where: { storeId },
      update: { planId: plan.id, status: SubscriptionStatus.ACTIVE },
      create: {
        storeId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }
}
