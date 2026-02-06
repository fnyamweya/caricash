import { Body, Controller, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { AgentAccessService } from './agent-access.service';
import { IamRepository } from '../iam/iam.repository';
import { ForbiddenError } from '@caricash/common';

@Controller('agent/access')
export class AgentAccessController {
  constructor(
    private readonly service: AgentAccessService,
    private readonly iamRepo: IamRepository,
  ) {}

  @Get('users')
  async listUsers(
    @Headers('x-user-id') actorUserId: string,
    @Headers('x-principal-id') principalId: string,
  ) {
    return this.service.listUsers({ actorUserId, principalId });
  }

  @Post('users')
  async assignUser(
    @Body() dto: { userId: string; roleName: string; attributes?: Record<string, unknown> },
    @Headers('x-user-id') actorUserId: string,
    @Headers('x-principal-id') principalId: string,
  ) {
    return this.service.assignUser({ ...dto, actorUserId, principalId });
  }

  @Patch('users/:id/attributes')
  async updateAttributes(
    @Param('id') membershipId: string,
    @Body() dto: { attributes: Record<string, unknown> },
    @Headers('x-user-id') actorUserId: string,
    @Headers('x-principal-id') principalId: string,
  ) {
    return this.service.updateAttributes({ membershipId, attributes: dto.attributes, actorUserId, principalId });
  }

  @Patch('users/:id/role')
  async updateRole(
    @Param('id') membershipId: string,
    @Body() dto: { roleName: string },
    @Headers('x-user-id') actorUserId: string,
    @Headers('x-principal-id') principalId: string,
  ) {
    return this.service.updateRole({ membershipId, roleName: dto.roleName, actorUserId, principalId });
  }

  @Get('roles')
  async listRoles() {
    return this.iamRepo.listRoles('AGENT');
  }

  @Post('roles')
  async createRole(
    @Body() dto: { name: string; description?: string },
    @Headers('x-user-id') actorUserId: string,
    @Headers('x-principal-id') principalId: string,
  ) {
    const membership = await this.iamRepo.findMembershipByUserAndPrincipal(actorUserId, principalId);
    if (!membership) {
      throw new ForbiddenError('No membership for principal');
    }
    const decision = await this.service.simulate({
      subject: { principalType: 'AGENT', roles: [membership.role_name], principalId },
      action: 'agent.role.manage',
      resource: { type: 'agent', attributes: { principalId } },
    });
    if (!decision.allow) {
      throw new ForbiddenError('Access denied');
    }
    if (decision.obligations.length > 0) {
      throw new ForbiddenError(`Obligations required: ${decision.obligations.join(',')}`);
    }
    return this.iamRepo.createRole({ name: dto.name, description: dto.description, scope: 'AGENT' });
  }

  @Post('simulate')
  async simulate(@Body() dto: { subject: { principalType: string; roles: string[]; principalId?: string; attributes?: Record<string, unknown> }; action: string; resource: { type: string; id?: string; attributes?: Record<string, unknown> }; context?: Record<string, unknown> }) {
    return this.service.simulate(dto);
  }
}
