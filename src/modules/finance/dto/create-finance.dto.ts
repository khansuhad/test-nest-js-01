import { FinanceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateFinanceDto {
  @IsEnum(FinanceType)
  type!: FinanceType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  @Length(3, 8)
  currency?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  category?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  subcategory?: string;

  /**
   * Accepts a single tag ("cash" / "profit") or an array. Normalised by the service.
   */
  @IsOptional()
  affectType?: string | string[];

  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  serviceId?: string;
}
