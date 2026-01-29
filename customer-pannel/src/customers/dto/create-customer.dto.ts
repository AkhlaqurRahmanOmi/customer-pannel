import {
  IsString,
  IsEmail,
  IsOptional,
  IsUrl,
  IsDateString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone2?: string;

  @IsOptional()
  @IsDateString()
  subscriptionDate?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  aboutCustomer?: string;
}
