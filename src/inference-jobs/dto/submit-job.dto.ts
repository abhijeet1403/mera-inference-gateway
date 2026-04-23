import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const MAX_REQUESTS_PER_JOB = 5000;

/**
 * One inference call inside a job. Shape mirrors an OpenAI chat.completions
 * request body, with an `id` the client uses to correlate results back. The
 * `messages[].content` is E2EE-encrypted ciphertext — the gateway never reads
 * or transforms it.
 */
export class InferenceRequestDto {
  @IsString()
  id!: string;

  @IsDefined()
  // Body is passed through to RedPill. We validate that it's an object but
  // don't constrain the shape — the upstream schema can evolve.
  body!: Record<string, unknown>;
}

/** E2EE headers forwarded to RedPill per request. Same session for all calls. */
export class E2EESessionDto {
  @IsOptional()
  @IsString()
  'X-Signing-Algo'?: string;

  @IsOptional()
  @IsString()
  'X-Client-Pub-Key'?: string;

  @IsOptional()
  @IsString()
  'X-Model-Pub-Key'?: string;
}

export class SubmitJobDto {
  @IsString()
  @Matches(/^ExponentPushToken\[.+\]$|^ExpoPushToken\[.+\]$/, {
    message: 'expoPushToken must be a valid Expo push token',
  })
  expoPushToken!: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => E2EESessionDto)
  e2eeSession?: E2EESessionDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_REQUESTS_PER_JOB)
  @ValidateNested({ each: true })
  @Type(() => InferenceRequestDto)
  requests!: InferenceRequestDto[];
}
