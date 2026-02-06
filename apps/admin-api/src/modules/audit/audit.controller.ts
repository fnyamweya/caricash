import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('events')
  async listEvents(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('resource_type') resourceType?: string,
  ) {
    return this.auditService.listEvents({
      cursor,
      limit: limit ? Number(limit) : undefined,
      action,
      resourceType,
    });
  }

  @Get('verify')
  async verifyChain() {
    return this.auditService.verifyChain();
  }
}
