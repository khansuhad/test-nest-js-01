import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(3, 30)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(0, 400)
  address?: string;

  @IsOptional()
  @IsString()
  @Length(0, 80)
  city?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}
