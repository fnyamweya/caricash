import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { CORRELATION_ID_HEADER } from '@caricash/common';

@Controller('admin/agents')
export class AgentsController {
  constructor(private readonly service: AgentsService) {}

  @Post()
  async createAgent(
    @Body() dto: { countryCode: string; displayName: string; level?: number; parentAgentId?: string | null },
    @Headers(CORRELATION_ID_HEADER) correlationId: string,
  ) {
    return this.service.createAgent({
      countryCode: dto.countryCode,
      displayName: dto.displayName,
      level: dto.level,
      parentAgentId: dto.parentAgentId,
      correlationId,
    });
  }

  @Patch(':id')
  async updateAgent(
    @Param('id') agentId: string,
    @Body() dto: { status?: string; parentAgentId?: string | null; level?: number },
    @Headers(CORRELATION_ID_HEADER) correlationId: string,
  ) {
    return this.service.updateAgent({
      agentId,
      status: dto.status,
      parentAgentId: dto.parentAgentId,
      level: dto.level,
      correlationId,
    });
  }

  @Get()
  async listAgents(
    @Query('country') countryCode?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listAgents({ countryCode, status });
  }
}
