import { IsBooleanString, IsOptional, IsString, Length } from 'class-validator';
import { PaginationDto } from '../../../common/utils/pagination';

export class ListServicesDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  search?: string;

  @IsOptional()
  @IsBooleanString()
  active?: string;
}
