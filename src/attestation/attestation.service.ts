import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REDPILL_BASE_URL } from '../constants';

@Injectable()
export class AttestationService {
  private readonly logger = new Logger(AttestationService.name);
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('RED_PILL_API_KEY', '');
    if (!this.apiKey) {
      throw new Error('RED_PILL_API_KEY environment variable is not set');
    }
  }

  /** Pure proxy: forward query params as-is to RedPill, return raw Response. */
  async proxyAttestationReport(
    queryString: string,
  ): Promise<globalThis.Response> {
    const url = `${REDPILL_BASE_URL}/attestation/report${queryString ? `?${queryString}` : ''}`;
    this.logger.debug(`Proxying attestation report: ${url}`);

    return fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
  }
}
