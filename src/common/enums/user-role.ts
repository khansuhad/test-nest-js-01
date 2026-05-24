import { UserRole as PrismaUserRole } from '@prisma/client';

/**
 * Stable runtime role constants for decorators (@Roles) and guards.
 * Mirrors prisma/schema.prisma `enum UserRole` — do not add values here
 * without updating the schema and running `npx prisma generate`.
 */
export const UserRole = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const USER_ROLE_VALUES: readonly UserRole[] = Object.values(UserRole);

const PRISMA_GENERATE_MESSAGE =
  'UserRole enum not generated. Run: npx prisma generate';

/**
 * Validates @prisma/client was generated and matches app role constants.
 * Runs when this module is first imported (before Nest bootstraps controllers).
 */
export function assertPrismaUserRoleEnum(): void {
  if (PrismaUserRole == null || typeof PrismaUserRole !== 'object') {
    throw new Error(PRISMA_GENERATE_MESSAGE);
  }
  if (PrismaUserRole.ADMIN == null) {
    throw new Error(PRISMA_GENERATE_MESSAGE);
  }

  const generated = Object.values(PrismaUserRole) as string[];
  for (const role of USER_ROLE_VALUES) {
    if (!generated.includes(role)) {
      throw new Error(
        `${PRISMA_GENERATE_MESSAGE} (schema/client mismatch: missing "${role}")`,
      );
    }
  }
}

assertPrismaUserRoleEnum();
