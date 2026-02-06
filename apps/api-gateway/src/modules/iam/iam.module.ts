import { Module } from '@nestjs/common';
import { IamRepository } from './iam.repository';

@Module({
  providers: [IamRepository],
  exports: [IamRepository],
})
export class IamModule {}
