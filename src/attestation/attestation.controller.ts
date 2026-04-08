import { Controller, Get, Logger, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AttestationService } from './attestation.service';
import { AttestationReportQueryDto } from './dto/attestation-report-query.dto';

@Controller('api/attestation')
@UseGuards(AuthGuard)
export class AttestationController {
  private readonly logger = new Logger(AttestationController.name);

  constructor(private readonly attestationService: AttestationService) {}

  @Get('report')
  async getReport(@Query() query: AttestationReportQueryDto) {
    this.logger.debug(
      `[attestation] model=${query.model ?? 'default'} nonce=${query.nonce ? 'present' : 'absent'}`,
    );
    return this.attestationService.getAttestationReport(query);
  }
}
