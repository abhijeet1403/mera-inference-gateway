import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_MODEL, REDPILL_BASE_URL } from '../constants';
import type { AttestationReportQueryDto } from './dto/attestation-report-query.dto';

@Injectable()
export class AttestationService {
  private readonly logger = new Logger(AttestationService.name);
  private readonly defaultModel: string;
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.defaultModel = DEFAULT_MODEL;
    this.apiKey = this.configService.get<string>('RED_PILL_API_KEY', '');
    if (!this.apiKey) {
      throw new Error('RED_PILL_API_KEY environment variable is not set');
    }
  }

  async getAttestationReport(
    query: AttestationReportQueryDto,
  ): Promise<Record<string, unknown>> {
    const model = query.model ?? this.defaultModel;
    const params = new URLSearchParams({ model });
    if (query.nonce) params.set('nonce', query.nonce);
    if (query.signing_address)
      params.set('signing_address', query.signing_address);
    if (query.signing_algo)
      params.set('signing_algo', query.signing_algo);

    const url = `${REDPILL_BASE_URL}/attestation/report?${params.toString()}`;
    this.logger.debug(`Fetching attestation report: model=${model}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`RedPill API error (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return { ...data, model };
  }
}
