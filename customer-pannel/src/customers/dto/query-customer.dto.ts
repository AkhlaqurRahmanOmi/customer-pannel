import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { PaginationOptions } from '@shared/interfaces';

export class QueryCustomerDto implements PaginationOptions {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
