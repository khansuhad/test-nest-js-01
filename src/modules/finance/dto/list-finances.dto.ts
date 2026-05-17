import { FinanceType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { PaginationDto } from '../../../common/utils/pagination';

export class ListFinancesDto extends PaginationDto {
  @IsOptional()
  @IsEnum(FinanceType)
  type?: FinanceType;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  category?: string;
}
