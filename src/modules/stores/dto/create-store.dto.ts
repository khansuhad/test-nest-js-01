import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateStoreDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(2, 60)
  @Matches(/^[a-z0-9-]+$/i, { message: 'slug must be alphanumeric with dashes' })
  slug?: string;

  @IsOptional()
  @IsString()
  @Length(3, 8)
  currency?: string;

  @IsOptional()
  @IsString()
  @Length(2, 64)
  timezone?: string;

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
}
