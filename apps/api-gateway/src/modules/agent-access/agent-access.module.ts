import { Module } from '@nestjs/common';
import { AgentAccessController } from './agent-access.controller';
import { AgentAccessService } from './agent-access.service';
import { IamModule } from '../iam/iam.module';
import { PolicyModule } from '../policy/policy.module';

@Module({
  imports: [IamModule, PolicyModule],
  controllers: [AgentAccessController],
  providers: [AgentAccessService],
})
export class AgentAccessModule {}
