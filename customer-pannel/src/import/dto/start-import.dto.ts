import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  Length,
} from "class-validator";


export class StartImportDto {

  @IsOptional()
  @IsString()
  @Length(1, 2048)
  filePath?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(10_000)
  batchSize?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(200)
  @Max(30_000)
  progressUpdateEveryMs?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50_000_000)
  totalRows?: number;
}
