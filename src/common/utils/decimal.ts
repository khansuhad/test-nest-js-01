import { Prisma } from '@prisma/client';

/**
 * Safely convert a Prisma Decimal (or number) to a JS number, treating null/undefined as 0.
 *
 * Use this everywhere a Decimal needs to be serialised to JSON: Prisma's groupBy
 * aggregates (`_sum`, `_avg`, etc.) are nullable, and `Number(decimal)` can lose
 * precision for large values — `.toNumber()` is the documented Decimal API.
 */
export function decimalToNumber(
  value: Prisma.Decimal | number | string | null | undefined,
): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return value.toNumber();
}
