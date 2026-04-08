import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_LLM_TEMPERATURE,
  DEFAULT_MODEL,
  REDPILL_BASE_URL,
} from '../constants';
import { ChatRequestBody } from './dto/chat.dto';
import { Readable } from 'stream';

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly defaultModel: string;
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.defaultModel = this.configService.get<string>(
      'DEFAULT_MODEL',
      DEFAULT_MODEL,
    );
    this.apiKey = this.configService.get<string>('RED_PILL_API_KEY', '');
    if (!this.apiKey) {
      throw new Error('RED_PILL_API_KEY environment variable is not set');
    }
    this.logger.log(`Default model: ${this.defaultModel}`);
  }

  /**
   * Proxy a chat completions request to RedPill AI.
   * Returns a Node.js Readable stream of the SSE response.
   *
   * Messages are E2EE-encrypted by the client — this service never inspects
   * or decrypts message content. It is an opaque passthrough.
   */
  async streamChat(
    body: ChatRequestBody,
  ): Promise<{ stream: Readable; contentType: string }> {
    const payload = {
      ...body,
      model: body.model ?? this.defaultModel,
      stream: true,
    };

    const response = await fetch(`${REDPILL_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      const errorBody = await response.text();
      throw new Error(`RedPill API error (${response.status}): ${errorBody}`);
    }

    const nodeStream = Readable.fromWeb(
      response.body as unknown as Parameters<typeof Readable.fromWeb>[0],
    );
    const contentType =
      response.headers.get('content-type') ?? 'text/event-stream';

    return { stream: nodeStream, contentType };
  }

  /**
   * Non-streaming E2EE chat completion.
   * Forwards client-provided E2EE headers to RedPill and returns the
   * encrypted response along with E2EE response headers.
   */
  async chatWithE2EE(
    body: ChatRequestBody,
    e2eeHeaders: Record<string, string>,
  ): Promise<{ json: unknown; responseHeaders: Record<string, string> }> {
    const payload = {
      ...body,
      model: body.model ?? this.defaultModel,
      stream: false,
    };

    const response = await fetch(`${REDPILL_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...e2eeHeaders,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`RedPill API error (${response.status}): ${errorBody}`);
    }

    const respHeaders: Record<string, string> = {};
    for (const name of ['x-e2ee-applied', 'x-e2ee-version', 'x-e2ee-algo']) {
      const val = response.headers.get(name);
      if (val) respHeaders[name] = val;
    }

    return { json: await response.json(), responseHeaders: respHeaders };
  }

  /** Generate text (non-streaming) via RedPill AI's chat completions endpoint. */
  async generateTextResponse(params: {
    system: string;
    prompt: string;
    temperature?: number;
    maxTokens?: number;
    model?: string;
  }): Promise<string> {
    const payload = {
      model: params.model ?? this.defaultModel,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.prompt },
      ],
      temperature: params.temperature ?? DEFAULT_LLM_TEMPERATURE,
      max_tokens: params.maxTokens ?? 16,
      stream: false,
    };

    const response = await fetch(`${REDPILL_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`RedPill API error (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    return (data.choices?.[0]?.message?.content ?? '').trim();
  }
}
