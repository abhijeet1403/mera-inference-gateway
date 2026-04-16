import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REDPILL_BASE_URL } from '../constants';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('RED_PILL_API_KEY', '');
    if (!this.apiKey) {
      throw new Error('RED_PILL_API_KEY environment variable is not set');
    }
    this.timeoutMs = this.configService.get<number>(
      'REDPILL_TIMEOUT_MS',
      30_000,
    );
  }

  /** Pure proxy: forward body as-is to RedPill, return raw Response. */
  async proxyChat(
    body: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<globalThis.Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const startedAt = Date.now();

    try {
      const response = await fetch(`${REDPILL_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          ...extraHeaders,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const elapsedMs = Date.now() - startedAt;
      this.logger.debug(
        `RedPill responded status=${response.status} elapsedMs=${elapsedMs}`,
      );
      return response;
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      if ((error as { name?: string })?.name === 'AbortError') {
        this.logger.error(
          `RedPill request timed out after ${elapsedMs}ms (limit=${this.timeoutMs}ms)`,
        );
      } else {
        this.logger.error(
          `RedPill fetch failed after ${elapsedMs}ms: ${(error as Error)?.message ?? String(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
