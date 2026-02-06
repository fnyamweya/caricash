import { Controller, Get, Post, Body, Param, Query, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { PostingRequest } from '@caricash/common';

@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Post('entries')
  @HttpCode(HttpStatus.CREATED)
  async postEntry(
    @Body() dto: Omit<PostingRequest, 'idempotencyKey' | 'correlationId'>,
    @Headers('idempotency-key') idempotencyKey: string,
    @Headers('x-correlation-id') correlationId: string,
  ) {
    return this.ledgerService.postEntry({
      ...dto,
      idempotencyKey,
      correlationId,
    });
  }

  @Post('entries/:entryId/reverse')
  @HttpCode(HttpStatus.CREATED)
  async reverseEntry(
    @Param('entryId') entryId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Headers('x-correlation-id') correlationId: string,
    @Body() dto: { description: string; businessDay: string },
  ) {
    return this.ledgerService.reverseEntry(entryId, {
      idempotencyKey,
      correlationId,
      description: dto.description,
      businessDay: dto.businessDay,
    });
  }

  @Get('accounts/:accountId/statement')
  async getStatement(
    @Param('accountId') accountId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ledgerService.getStatement(accountId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
