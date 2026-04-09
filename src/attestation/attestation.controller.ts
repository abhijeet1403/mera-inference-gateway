import { Controller, Get, Logger, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AttestationService } from './attestation.service';

@Controller('api/attestation')
@UseGuards(AuthGuard)
export class AttestationController {
  private readonly logger = new Logger(AttestationController.name);

  constructor(private readonly attestationService: AttestationService) {}

  @Get('report')
  async getReport(@Req() req: Request, @Res() res: Response) {
    try {
      const upstream = await this.attestationService.proxyAttestationReport(
        req.url.split('?')[1] ?? '',
      );

      res.status(upstream.status);

      const contentType = upstream.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);

      const body = await upstream.text();
      res.send(body);
    } catch (error) {
      this.logger.error(
        'Attestation proxy failed',
        error instanceof Error ? error.stack : error,
      );
      if (!res.headersSent) {
        res.status(502).json({ error: 'Upstream request failed' });
      }
    }
  }
}
