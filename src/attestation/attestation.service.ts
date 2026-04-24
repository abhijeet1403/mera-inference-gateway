import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NEARAI_BASE_URL,
  REDPILL_BASE_URL,
  type ProviderName,
} from '../constants';

interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
}

@Injectable()
export class AttestationService {
  private readonly logger = new Logger(AttestationService.name);
  private readonly providers: Record<ProviderName, ProviderConfig>;

  constructor(private configService: ConfigService) {
    const redpillKey = this.configService.get<string>('RED_PILL_API_KEY', '');
    if (!redpillKey) {
      throw new Error('RED_PILL_API_KEY environment variable is not set');
    }
    const nearKey = this.configService.get<string>('NEAR_AI_API_KEY', '');
    if (!nearKey) {
      this.logger.warn(
        'NEAR_AI_API_KEY is not set; nearai provider attestation will fail',
      );
    }
    this.providers = {
      redpill: { baseUrl: REDPILL_BASE_URL, apiKey: redpillKey },
      nearai: { baseUrl: NEARAI_BASE_URL, apiKey: nearKey },
    };
  }

  /** Pure proxy: forward query params as-is to the provider's attestation
   *  endpoint, return raw Response. The `provider` query param (if present)
   *  is stripped before forwarding so it doesn't leak upstream. */
  async proxyAttestationReport(
    provider: ProviderName,
    queryString: string,
  ): Promise<globalThis.Response> {
    const cfg = this.providers[provider];
    if (!cfg) throw new Error(`Unknown provider: ${provider}`);
    if (!cfg.apiKey) {
      throw new Error(`Provider ${provider} has no API key configured`);
    }

    const cleanedQs = stripProviderParam(queryString);
    const url = `${cfg.baseUrl}/attestation/report${cleanedQs ? `?${cleanedQs}` : ''}`;
    this.logger.debug(`Proxying attestation report (${provider}): ${url}`);

    const controller = new AbortController();
    const timeoutMs = 30_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
        signal: controller.signal,
      });
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        throw new Error(
          `Upstream attestation timeout after ${timeoutMs}ms (provider=${provider}, url=${url})`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function stripProviderParam(qs: string): string {
  if (!qs) return qs;
  const params = new URLSearchParams(qs);
  params.delete('provider');
  return params.toString();
}
