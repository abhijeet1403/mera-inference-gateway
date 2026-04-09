import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REDPILL_BASE_URL } from '../constants';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('RED_PILL_API_KEY', '');
    if (!this.apiKey) {
      throw new Error('RED_PILL_API_KEY environment variable is not set');
    }
  }

  /** Pure proxy: forward body as-is to RedPill, return raw Response. */
  async proxyChat(
    body: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<globalThis.Response> {
    return fetch(`${REDPILL_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });
  }
}
