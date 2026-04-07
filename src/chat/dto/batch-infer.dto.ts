import {
  IsString,
  IsArray,
  IsOptional,
  IsNumber,
  ValidateNested,
  Min,
  Max,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

class UserPromptDto {
  @IsString()
  id!: string;

  @IsString()
  prompt!: string;
}

class BatchInferGroupDto {
  @IsString()
  system!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserPromptDto)
  @ArrayMaxSize(50)
  prompts!: UserPromptDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1024)
  maxTokens?: number;

  @IsOptional()
  @IsString()
  model?: string;
}

export class BatchInferRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchInferGroupDto)
  @ArrayMaxSize(10)
  batches!: BatchInferGroupDto[];
}
