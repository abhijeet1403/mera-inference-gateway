import { Controller, Get, Logger, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import type { ProviderName } from '../constants';
import { AttestationService } from './attestation.service';

function resolveProvider(q: unknown): ProviderName {
  return q === 'nearai' ? 'nearai' : 'redpill';
}

@Controller('api')
@UseGuards(AuthGuard)
export class AttestationController {
  private readonly logger = new Logger(AttestationController.name);

  constructor(private readonly attestationService: AttestationService) {}

  @Get('attestation/report')
  async getReport(
    @Query('provider') providerQ: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const provider = resolveProvider(providerQ);
    const queryString = req.url.split('?')[1] ?? '';
    const startedAt = Date.now();
    try {
      const upstream = await this.attestationService.proxyAttestationReport(
        provider,
        queryString,
      );

      res.status(upstream.status);
      const contentType = upstream.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      const body = await upstream.text();
      res.send(body);
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      const err = error as
        | (Error & { code?: string; cause?: { code?: string } })
        | undefined;
      this.logger.error(
        {
          msg: 'Attestation proxy failed',
          provider,
          queryString,
          elapsedMs,
          errorName: err?.name,
          errorMessage: err?.message,
          errorCode: err?.code ?? err?.cause?.code,
        },
        err?.stack,
      );
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Upstream request failed',
          provider,
          reason: err?.message ?? 'unknown',
        });
      }
    }
  }
}
