import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CORRELATION_ID_HEADER, IDEMPOTENCY_KEY_HEADER } from '@caricash/common';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() dto: { countryCode: string; msisdn: string; pin: string; displayName: string },
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey: string,
    @Headers(CORRELATION_ID_HEADER) correlationId: string,
    @Headers('x-device-id') deviceId?: string,
    @Headers('x-forwarded-for') ip?: string,
  ) {
    return this.customersService.signup({
      ...dto,
      idempotencyKey,
      ip,
      deviceId,
    });
  }

  @Get('me')
  async getMe(@Headers('x-user-id') userId: string) {
    return this.customersService.getProfile(userId);
  }
}
