/**
 * Hisab247 seed.
 *
 * Idempotent: safe to re-run. Produces a complete test bed for Postman:
 *
 *   Plans:       FREE, BASIC, PRO, ENTERPRISE
 *
 *   Store A — "Test POS Store"      publicId=100001  plan=PRO
 *     ADMIN    01700000001 / Test@1234
 *     MANAGER  01700000002 / Test@1234
 *     CASHIER  01700000003 / Test@1234
 *     5 customers, 3 services (various statuses), 5 finance entries,
 *     1 custom finance category, 2 device logins.
 *
 *   Store B — "Side Shop"            publicId=100002  plan=FREE
 *     ADMIN    01700000010 / Test@1234
 *     2 customers, 1 service, 2 finance entries, 1 device login.
 *
 * After seeding, run `npm run token [persona]` to mint a JWT for any user.
 * See TEST_CREDENTIALS.md for the full directory.
 */

import {
  FinanceType,
  Prisma,
  PrismaClient,
  ServiceStatus,
  SubscriptionPlanTier,
  SubscriptionStatus,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PASSWORD = 'Test@1234';

// =================================================================
// Plans
// =================================================================
async function seedPlans() {
  const plans = [
    {
      tier: SubscriptionPlanTier.FREE,
      name: 'Free',
      priceMonthly: new Prisma.Decimal(0),
      priceYearly: new Prisma.Decimal(0),
      maxUsers: 1,
      maxCustomers: 50,
      maxJobsPerMonth: 25,
      features: { dashboard: true, exports: false, multiUser: false },
    },
    {
      tier: SubscriptionPlanTier.BASIC,
      name: 'Basic',
      priceMonthly: new Prisma.Decimal(9),
      priceYearly: new Prisma.Decimal(90),
      maxUsers: 3,
      maxCustomers: 500,
      maxJobsPerMonth: 200,
      features: { dashboard: true, exports: true, multiUser: true },
    },
    {
      tier: SubscriptionPlanTier.PRO,
      name: 'Pro',
      priceMonthly: new Prisma.Decimal(29),
      priceYearly: new Prisma.Decimal(290),
      maxUsers: 10,
      maxCustomers: 5000,
      maxJobsPerMonth: 2000,
      features: { dashboard: true, exports: true, multiUser: true, api: true },
    },
    {
      tier: SubscriptionPlanTier.ENTERPRISE,
      name: 'Enterprise',
      priceMonthly: new Prisma.Decimal(99),
      priceYearly: new Prisma.Decimal(990),
      maxUsers: 1000,
      maxCustomers: 1_000_000,
      maxJobsPerMonth: 1_000_000,
      features: { dashboard: true, exports: true, multiUser: true, api: true, sso: true },
    },
  ];
  for (const p of plans) {
    await prisma.plan.upsert({ where: { tier: p.tier }, update: p, create: p });
  }
  console.log(`✓ Plans: ${plans.length}`);
}

// =================================================================
// Store factory
// =================================================================
async function seedStore(args: {
  publicId: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  currency: string;
  timezone: string;
  address: string;
}) {
  const existing = await prisma.store.findFirst({ where: { publicId: args.publicId } });
  if (existing) return existing;
  return prisma.store.create({
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

// =================================================================
// User factory
// =================================================================
async function seedUser(args: {
  storeId: string;
  mobile: string;
  name: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  publicId: string;
}) {
  return prisma.user.upsert({
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

// =================================================================
// Subscription factory
// =================================================================
async function seedSubscription(storeId: string, tier: SubscriptionPlanTier) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { tier } });
  return prisma.subscription.upsert({
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

// =================================================================
// MAIN
// =================================================================
async function main() {
  await seedPlans();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ============================================================
  // STORE A — Test POS Store (PRO, 3 users)
  // ============================================================
  let storeA = await seedStore({
    publicId: '100001',
    name: 'Test POS Store',
    slug: 'test-pos-store',
    email: 'owner@test-pos.com',
    phone: '01700000001',
    currency: 'BDT',
    timezone: 'Asia/Dhaka',
    address: 'Road 1, Dhaka, Bangladesh',
  });
  console.log(`✓ Store A: ${storeA.name} (publicId=${storeA.publicId})`);

  const adminA = await seedUser({
    storeId: storeA.id,
    mobile: '01700000001',
    name: 'Asma Admin',
    email: 'admin@test-pos.com',
    role: UserRole.ADMIN,
    passwordHash,
    publicId: 'U10001',
  });
  const managerA = await seedUser({
    storeId: storeA.id,
    mobile: '01700000002',
    name: 'Manik Manager',
    email: 'manager@test-pos.com',
    role: UserRole.MANAGER,
    passwordHash,
    publicId: 'U10002',
  });
  const cashierA = await seedUser({
    storeId: storeA.id,
    mobile: '01700000003',
    name: 'Karim Cashier',
    email: 'cashier@test-pos.com',
    role: UserRole.CASHIER,
    passwordHash,
    publicId: 'U10003',
  });
  // Backfill ownerId on store A
  if (storeA.ownerId !== adminA.id) {
    storeA = await prisma.store.update({
      where: { id: storeA.id },
      data: { ownerId: adminA.id },
    });
  }
  console.log(`  Users: ADMIN=${adminA.mobile}  MANAGER=${managerA.mobile}  CASHIER=${cashierA.mobile}`);

  await seedSubscription(storeA.id, SubscriptionPlanTier.PRO);
  console.log('  Subscription: PRO (active)');

  // Customers in Store A
  const customersA = [
    { publicId: '200001', name: 'Rahim Khan',    phone: '01911111101', email: 'rahim@example.com',  city: 'Dhaka',     address: 'Mirpur 10',  notes: 'Premium customer' },
    { publicId: '200002', name: 'Sumi Akter',    phone: '01911111102', email: 'sumi@example.com',   city: 'Dhaka',     address: 'Banani 11',  notes: null },
    { publicId: '200003', name: 'Fahim Hossain', phone: '01911111103', email: 'fahim@example.com',  city: 'Chittagong',address: 'GEC',        notes: 'Walk-in' },
    { publicId: '200004', name: 'Nila Sultana',  phone: '01911111104', email: null,                 city: 'Sylhet',    address: 'Zindabazar', notes: null },
    { publicId: '200005', name: 'Tareq Aziz',    phone: '01911111105', email: 'tareq@example.com',  city: 'Dhaka',     address: 'Uttara 7',   notes: 'Bulk client' },
  ];
  for (const c of customersA) {
    await prisma.customer.upsert({
      where: { storeId_phone: { storeId: storeA.id, phone: c.phone } },
      update: {},
      create: { ...c, storeId: storeA.id, createdBy: adminA.id },
    });
  }
  console.log(`  Customers: ${customersA.length}`);

  // Services in Store A — various statuses
  const servicesA = [
    {
      publicId: '300001', name: 'Display Replacement',
      number: '01911111101', model: 'iPhone 15 Pro', problem: 'Cracked screen',
      status: ServiceStatus.IN_PROGRESS,
      price: 12000, partsCost: 7500, discount: 500, advancedAmount: 2000,
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
    },
  ];
  for (const s of servicesA) {
    await prisma.service.upsert({
      where: { storeId_publicId: { storeId: storeA.id, publicId: s.publicId } },
      update: {},
      create: {
        ...s,
        storeId: storeA.id,
        price: new Prisma.Decimal(s.price),
        partsCost: new Prisma.Decimal(s.partsCost),
        discount: new Prisma.Decimal(s.discount),
        advancedAmount: new Prisma.Decimal(s.advancedAmount),
        finalPrice: s.finalPrice !== undefined ? new Prisma.Decimal(s.finalPrice) : undefined,
      },
    });
  }
  console.log(`  Services: ${servicesA.length}`);

  // Custom finance category in Store A
  await prisma.financeCategory.upsert({
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
  console.log('  Custom finance category: 1');

  // Finance entries in Store A
  const customer1 = await prisma.customer.findFirst({ where: { storeId: storeA.id, phone: '01911111101' } });
  const service1 = await prisma.service.findFirst({ where: { storeId: storeA.id, publicId: '300001' } });
  const service2 = await prisma.service.findFirst({ where: { storeId: storeA.id, publicId: '300002' } });

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
    },
    {
      publicId: '400003', type: FinanceType.EXPENSE, amount: 5000,
      category: 'operating_expenses', subcategory: 'rent', affectType: ['profit'],
      notes: 'Shop monthly rent',
    },
    {
      publicId: '400004', type: FinanceType.INCOME, amount: 20000,
      category: 'cash_in', subcategory: 'owner_investment', affectType: ['cash'],
      notes: 'Owner topped up working cash',
    },
    {
      publicId: '400005', type: FinanceType.EXPENSE, amount: 3500,
      category: 'cash_out', subcategory: 'owner_withdrawal', affectType: ['cash'],
      notes: 'Owner withdrew cash',
    },
  ];
  for (const f of financesA) {
    await prisma.finance.upsert({
      where: { storeId_publicId: { storeId: storeA.id, publicId: f.publicId } },
      update: {},
      create: {
        ...f,
        storeId: storeA.id,
        amount: new Prisma.Decimal(f.amount),
        currency: 'BDT',
        customerName: customer1?.name,
        customerPhone: customer1?.phone ?? undefined,
        createdBy: adminA.id,
      },
    });
  }
  console.log(`  Finance entries: ${financesA.length}`);

  // Devices in Store A
  await prisma.deviceLogin.upsert({
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
  await prisma.deviceLogin.upsert({
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
  console.log('  Devices: 2');

  // ============================================================
  // STORE B — Side Shop (FREE, 1 user) — for cross-tenant tests
  // ============================================================
  let storeB = await seedStore({
    publicId: '100002',
    name: 'Side Shop',
    slug: 'side-shop',
    email: 'side@shop.com',
    phone: '01700000010',
    currency: 'BDT',
    timezone: 'Asia/Dhaka',
    address: 'Road 9, Chittagong',
  });
  console.log(`✓ Store B: ${storeB.name} (publicId=${storeB.publicId})`);

  const adminB = await seedUser({
    storeId: storeB.id,
    mobile: '01700000010',
    name: 'Bappi Boss',
    email: 'admin@side-shop.com',
    role: UserRole.ADMIN,
    passwordHash,
    publicId: 'U20001',
  });
  if (storeB.ownerId !== adminB.id) {
    storeB = await prisma.store.update({ where: { id: storeB.id }, data: { ownerId: adminB.id } });
  }
  await seedSubscription(storeB.id, SubscriptionPlanTier.FREE);
  console.log(`  User: ADMIN=${adminB.mobile}  |  Subscription: FREE`);

  for (const c of [
    { publicId: '210001', name: 'Chittagong Customer 1', phone: '01922222201', city: 'Chittagong' },
    { publicId: '210002', name: 'Chittagong Customer 2', phone: '01922222202', city: 'Chittagong' },
  ]) {
    await prisma.customer.upsert({
      where: { storeId_phone: { storeId: storeB.id, phone: c.phone } },
      update: {},
      create: { ...c, storeId: storeB.id, createdBy: adminB.id },
    });
  }

  await prisma.service.upsert({
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

  for (const f of [
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
  ]) {
    await prisma.finance.upsert({
      where: { storeId_publicId: { storeId: storeB.id, publicId: f.publicId } },
      update: {},
      create: {
        ...f,
        storeId: storeB.id,
        amount: new Prisma.Decimal(f.amount),
        currency: 'BDT',
        createdBy: adminB.id,
      },
    });
  }

  await prisma.deviceLogin.upsert({
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

  console.log('  Customers: 2  |  Services: 1  |  Finances: 2  |  Devices: 1');

  // ============================================================
  // PRINT SUMMARY
  // ============================================================
  console.log('\n=========================== TEST USERS ===========================');
  console.log('Password for every account: ' + PASSWORD);
  console.log('Mint a JWT: npm run token [persona]');
  console.log('------------------------------------------------------------------');
  console.log('Persona       | Mobile        | Role     | Store          | Plan');
  console.log('------------------------------------------------------------------');
  console.log('admin         | 01700000001   | ADMIN    | Test POS Store | PRO');
  console.log('manager       | 01700000002   | MANAGER  | Test POS Store | PRO');
  console.log('cashier       | 01700000003   | CASHIER  | Test POS Store | PRO');
  console.log('store2-admin  | 01700000010   | ADMIN    | Side Shop      | FREE');
  console.log('==================================================================\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
