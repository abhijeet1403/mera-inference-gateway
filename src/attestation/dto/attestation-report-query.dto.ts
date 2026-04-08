import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class AttestationReportQueryDto {
  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  @Length(64, 64)
  @Matches(/^[0-9a-f]{64}$/, {
    message: 'nonce must be a 64-character lowercase hex string (32 bytes)',
  })
  nonce?: string;

  @IsOptional()
  @IsString()
  signing_address?: string;

  @IsOptional()
  @IsString()
  signing_algo?: string;
}
