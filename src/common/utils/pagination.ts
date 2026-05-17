import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }

  get take(): number {
    return this.limit;
  }
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function buildPage<T>(rows: T[], total: number, p: PaginationDto): { data: T[]; meta: PageMeta } {
  return {
    data: rows,
    meta: {
      page: p.page,
      limit: p.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / p.limit)),
    },
  };
}
