/**
 * Mint a JWT for any seeded test user.
 *
 * Usage:
 *   npm run token                    # default: admin (Store A) — 24h
 *   npm run token admin              # Store A ADMIN
 *   npm run token manager            # Store A MANAGER
 *   npm run token cashier            # Store A CASHIER
 *   npm run token store2-admin       # Store B ADMIN
 *   npm run token admin 7d           # custom expiry
 *
 * Reads JWT_SECRET / JWT_ALGORITHM / JWT_ISSUER / JWT_AUDIENCE from .env.
 * Token claims are aligned with `AuthUser` so the JwtAuthGuard accepts them.
 */

import * as dotenv from 'dotenv';
import * as jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const PERSONAS: Record<string, string> = {
  admin: '01700000001',
  manager: '01700000002',
  cashier: '01700000003',
  'store2-admin': '01700000010',
};

function parseArgs(): { persona: string; expiresIn: string } {
  const raw = process.argv.slice(2);
  let persona = 'admin';
  let expiresIn = '24h';

  for (const arg of raw) {
    if (PERSONAS[arg]) persona = arg;
    else if (/^\d+[smhdwy]$/.test(arg) || /^\d+$/.test(arg)) expiresIn = arg;
    else if (arg.startsWith('--')) continue;
    else console.warn(`(ignoring unknown arg "${arg}")`);
  }
  return { persona, expiresIn };
}

async function main() {
  const { persona, expiresIn } = parseArgs();
  const mobile = PERSONAS[persona];
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error('ERROR: JWT_SECRET is not set in .env');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const user = await prisma.user.findUnique({
    where: { mobile },
    include: { store: { include: { subscription: { include: { plan: true } } } } },
  });
  await prisma.$disconnect();

  if (!user || !user.store) {
    console.error(
      `ERROR: Persona "${persona}" (mobile=${mobile}) not found or has no store.\n` +
      `Run "npm run prisma:seed" first.`,
    );
    process.exit(1);
  }

  const payload = {
    sub: user.id,
    userId: user.id,
    email: user.email ?? undefined,
    mobile: user.mobile,
    role: user.role,
    storeId: user.store.id,
    subscriptionPlan: user.store.subscription?.plan.tier ?? 'FREE',
  };

  const token = jwt.sign(payload, secret, {
    algorithm: (process.env.JWT_ALGORITHM ?? 'HS256') as jwt.Algorithm,
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
    expiresIn: expiresIn as unknown as number,
  });

  console.log('\n=========== HISAB247 TEST JWT ===========');
  console.log(`Persona:     ${persona}`);
  console.log(`User:        ${user.name ?? user.mobile}`);
  console.log(`Mobile:      ${user.mobile}`);
  console.log(`Role:        ${user.role}`);
  console.log(`Store:       ${user.store.name}  (publicId=${user.store.publicId})`);
  console.log(`Store id:    ${user.store.id}`);
  console.log(`Plan:        ${user.store.subscription?.plan.tier ?? 'FREE'}`);
  console.log(`Expires in:  ${expiresIn}`);
  console.log('-----------------------------------------');
  console.log('\nAuthorization header (paste into Postman):\n');
  console.log(`Authorization: Bearer ${token}`);
  console.log('\nRaw token:\n');
  console.log(token);
  console.log('\nAvailable personas: ' + Object.keys(PERSONAS).join(', '));
  console.log('=========================================\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
