import {
  Body,
  Controller,
  Logger,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { ChatService } from './chat.service';
import { ChatRequestBody } from './dto/chat.dto';
import { BatchInferRequestDto } from './dto/batch-infer.dto';

/** Map Express-normalized (lowercase) header names → canonical case for RedPill API. */
const E2EE_HEADER_MAP: Record<string, string> = {
  'x-signing-algo': 'X-Signing-Algo',
  'x-client-pub-key': 'X-Client-Pub-Key',
  'x-model-pub-key': 'X-Model-Pub-Key',
  'x-e2ee-version': 'X-E2EE-Version',
  'x-e2ee-nonce': 'X-E2EE-Nonce',
  'x-e2ee-timestamp': 'X-E2EE-Timestamp',
};

@Controller('api')
@UseGuards(AuthGuard)
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @Post('chat')
  async chat(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const body = req.body as ChatRequestBody;
    const userId = req.user?.id;
    const e2eeHeaders = this.extractE2EEHeaders(req);

    if (e2eeHeaders) {
      // Non-streaming E2EE path
      try {
        const { json, responseHeaders } = await this.chatService.chatWithE2EE(
          body,
          e2eeHeaders,
        );
        for (const [k, v] of Object.entries(responseHeaders))
          res.setHeader(k, v);
        res.json(json);
      } catch (error) {
        this.logger.error(
          `E2EE chat failed for user=${userId ?? 'unknown'}`,
          error instanceof Error ? error.stack : error,
        );
        if (!res.headersSent) {
          res.status(500).json({ error: 'Inference request failed' });
        }
      }
      return;
    }

    // Non-E2EE path — streaming or non-streaming based on body.stream
    if (body.stream === false) {
      // Non-streaming plaintext path (used by scoring/completion calls)
      try {
        const json = await this.chatService.chatNonStreaming(body);
        res.json(json);
      } catch (error) {
        this.logger.error(
          `Chat (non-streaming) failed for user=${userId ?? 'unknown'}`,
          error instanceof Error ? error.stack : error,
        );
        if (!res.headersSent) {
          res.status(500).json({ error: 'Inference request failed' });
        }
      }
      return;
    }

    // Streaming path
    try {
      const { stream, contentType } = await this.chatService.streamChat(body);

      // SSE headers for streaming — Content-Encoding: none is critical
      // for React Native fetch to not attempt decompression.
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Encoding', 'none');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      stream.pipe(res);

      stream.on('error', (err) => {
        this.logger.error(
          `Chat stream pipe error for user=${userId ?? 'unknown'}`,
          err instanceof Error ? err.stack : err,
        );
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream failed' });
        }
      });
    } catch (error) {
      this.logger.error(
        `Chat stream failed for user=${userId ?? 'unknown'}`,
        error instanceof Error ? error.stack : error,
      );

      if (!res.headersSent) {
        res.status(500).json({ error: 'Inference request failed' });
      }
    }
  }

  @Post('batch-infer')
  async batchInfer(
    @Req() req: AuthenticatedRequest,
    @Body() body: BatchInferRequestDto,
  ) {
    const results = await Promise.all(
      body.batches.flatMap((batch) =>
        batch.prompts.map(async (userPrompt) => {
          try {
            const text = await this.chatService.generateTextResponse({
              system: batch.system,
              prompt: userPrompt.prompt,
              temperature: batch.temperature,
              maxTokens: batch.maxTokens,
              model: batch.model,
            });
            return { id: userPrompt.id, output: text, error: null };
          } catch {
            return {
              id: userPrompt.id,
              output: null,
              error: 'Inference failed',
            };
          }
        }),
      ),
    );

    return { results };
  }

  private extractE2EEHeaders(req: Request): Record<string, string> | null {
    const version = req.headers['x-e2ee-version'];
    if (!version) return null;

    const headers: Record<string, string> = {};
    for (const [lower, canonical] of Object.entries(E2EE_HEADER_MAP)) {
      const value = req.headers[lower];
      if (typeof value === 'string') headers[canonical] = value;
    }
    return headers;
  }
}
