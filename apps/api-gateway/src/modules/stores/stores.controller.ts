import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { StoresService } from './stores.service';
import { CORRELATION_ID_HEADER } from '@caricash/common';

@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  async signup(
    @Body() dto: { countryCode: string; legalName: string; tillCount?: number },
    @Headers('x-user-id') ownerUserId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId: string,
  ) {
    return this.storesService.signup({
      ownerUserId,
      countryCode: dto.countryCode,
      legalName: dto.legalName,
      tillCount: dto.tillCount,
      correlationId,
    });
  }

  @Get('me')
  async getStore(@Headers('x-user-id') userId: string) {
    return this.storesService.getStoreForUser(userId);
  }

  @Get('me/tills')
  async getTills(@Headers('x-user-id') userId: string) {
    const { store } = await this.storesService.getStoreForUser(userId);
    return this.storesService.listTillsForPrincipal(store.principal_id);
  }
}
