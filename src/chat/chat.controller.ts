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

const E2EE_HEADER_NAMES = [
  'x-signing-algo',
  'x-client-pub-key',
  'x-model-pub-key',
  'x-e2ee-version',
  'x-e2ee-nonce',
  'x-e2ee-timestamp',
] as const;

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
        this.logger.debug(
          `[chat:e2ee] user=${userId} model=${body.model ?? 'default'} messages=${body.messages?.length ?? 0}`,
        );
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

    // Existing streaming path
    try {
      this.logger.debug(
        `[chat] user=${userId} model=${body.model ?? 'default'} messages=${body.messages?.length ?? 0}`,
      );
      const startTime = Date.now();

      const { stream, contentType } = await this.chatService.streamChat(body);

      // SSE headers for streaming — Content-Encoding: none is critical
      // for React Native fetch to not attempt decompression.
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Encoding', 'none');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      stream.pipe(res);

      stream.on('end', () => {
        this.logger.debug(
          `[chat] user=${userId} completed in ${Date.now() - startTime}ms`,
        );
      });

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
    const userId = req.user?.id;
    const totalPrompts = body.batches.reduce(
      (sum, b) => sum + b.prompts.length,
      0,
    );
    this.logger.debug(
      `[batch] user=${userId} batches=${body.batches.length} prompts=${totalPrompts}`,
    );
    const startTime = Date.now();

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
          } catch (error) {
            this.logger.error(
              `Batch infer failed id=${userPrompt.id} user=${userId ?? 'unknown'}`,
              error instanceof Error ? error.stack : error,
            );
            return {
              id: userPrompt.id,
              output: null,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        }),
      ),
    );

    const errors = results.filter((r) => r.error).length;
    this.logger.debug(
      `[batch] user=${userId} completed in ${Date.now() - startTime}ms prompts=${totalPrompts} errors=${errors}`,
    );

    return { results };
  }

  private extractE2EEHeaders(req: Request): Record<string, string> | null {
    const version = req.headers['x-e2ee-version'];
    if (!version) return null;

    const headers: Record<string, string> = {};
    for (const name of E2EE_HEADER_NAMES) {
      const value = req.headers[name];
      if (typeof value === 'string') headers[name] = value;
    }
    return headers;
  }
}
