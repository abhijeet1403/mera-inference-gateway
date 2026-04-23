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
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly timeoutMs: number;
  private readonly providers: Record<ProviderName, ProviderConfig>;

  constructor(private configService: ConfigService) {
    const redpillKey = this.configService.get<string>('RED_PILL_API_KEY', '');
    if (!redpillKey) {
      throw new Error('RED_PILL_API_KEY environment variable is not set');
    }
    const nearKey = this.configService.get<string>('NEAR_AI_API_KEY', '');
    if (!nearKey) {
      // Don't hard-fail — operators can run the gateway with only one provider
      // wired up, and users pinned to that provider will still work.
      this.logger.warn(
        'NEAR_AI_API_KEY is not set; nearai provider requests will fail',
      );
    }
    this.providers = {
      redpill: { baseUrl: REDPILL_BASE_URL, apiKey: redpillKey },
      nearai: { baseUrl: NEARAI_BASE_URL, apiKey: nearKey },
    };
    this.timeoutMs = this.configService.get<number>(
      'UPSTREAM_TIMEOUT_MS',
      30_000,
    );
  }

  /** Pure proxy: forward body as-is to the chosen provider. */
  async proxyChat(
    provider: ProviderName,
    body: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<globalThis.Response> {
    const cfg = this.providers[provider];
    if (!cfg) throw new Error(`Unknown provider: ${provider}`);
    if (!cfg.apiKey) {
      throw new Error(`Provider ${provider} has no API key configured`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const startedAt = Date.now();

    try {
      const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
          ...extraHeaders,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const elapsedMs = Date.now() - startedAt;
      this.logger.debug(
        `${provider} responded status=${response.status} elapsedMs=${elapsedMs}`,
      );
      return response;
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      if ((error as { name?: string })?.name === 'AbortError') {
        this.logger.error(
          `${provider} request timed out after ${elapsedMs}ms (limit=${this.timeoutMs}ms)`,
        );
      } else {
        this.logger.error(
          `${provider} fetch failed after ${elapsedMs}ms: ${(error as Error)?.message ?? String(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
