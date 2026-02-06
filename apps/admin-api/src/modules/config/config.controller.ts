import { Controller, Get } from '@nestjs/common';
import { ConfigService } from './config.service';

@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get('countries')
  async listCountries() {
    return this.configService.listCountries();
  }

  @Get('currencies')
  async listCurrencies() {
    return this.configService.listCurrencies();
  }
}
