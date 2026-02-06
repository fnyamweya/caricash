import { Injectable } from '@nestjs/common';
import { ConfigRepository } from './config.repository';

@Injectable()
export class ConfigService {
  constructor(private readonly repo: ConfigRepository) {}

  async listCountries() {
    return this.repo.listCountries();
  }

  async listCurrencies() {
    return this.repo.listCurrencies();
  }
}
