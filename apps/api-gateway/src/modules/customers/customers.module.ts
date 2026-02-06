import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { IamModule } from '../iam/iam.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { SecurityModule } from '../security/security.module';
import { KycModule } from '../kyc/kyc.module';

@Module({
  imports: [IamModule, IdempotencyModule, SecurityModule, KycModule],
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
