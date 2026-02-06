import { Module } from '@nestjs/common';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';
import { StoresRepository } from './stores.repository';
import { IamModule } from '../iam/iam.module';

@Module({
  imports: [IamModule],
  controllers: [StoresController],
  providers: [StoresService, StoresRepository],
})
export class StoresModule {}
