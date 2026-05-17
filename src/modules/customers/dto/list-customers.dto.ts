import { IsOptional, IsString, Length } from 'class-validator';
import { PaginationDto } from '../../../common/utils/pagination';

export class ListCustomersDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  search?: string;
}
