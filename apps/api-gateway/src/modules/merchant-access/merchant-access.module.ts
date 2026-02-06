import { Module } from '@nestjs/common';
import { MerchantAccessController } from './merchant-access.controller';
import { MerchantAccessService } from './merchant-access.service';
import { IamModule } from '../iam/iam.module';
import { PolicyModule } from '../policy/policy.module';

@Module({
  imports: [IamModule, PolicyModule],
  controllers: [MerchantAccessController],
  providers: [MerchantAccessService],
})
export class MerchantAccessModule {}
