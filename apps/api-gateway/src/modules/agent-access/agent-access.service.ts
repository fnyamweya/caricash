import { Injectable } from '@nestjs/common';
import { IamRepository } from '../iam/iam.repository';
import { PolicyService } from '../policy/policy.service';
import { ForbiddenError, ValidationError } from '@caricash/common';

@Injectable()
export class AgentAccessService {
  constructor(
    private readonly iamRepo: IamRepository,
    private readonly policyService: PolicyService,
  ) {}

  private async enforce(params: { actorUserId: string; principalId: string; action: string; resourceId?: string }) {
    const membership = await this.iamRepo.findMembershipByUserAndPrincipal(params.actorUserId, params.principalId);
    if (!membership) {
      throw new ForbiddenError('No membership for agent principal');
    }
    const decision = this.policyService.evaluate(
      {
        principalType: 'AGENT',
        principalId: params.principalId,
        roles: [membership.role_name],
        attributes: membership.member_attributes,
      },
      params.action,
      { type: 'agent', id: params.resourceId, attributes: { principalId: params.principalId } },
      {},
    );
    if (!decision.allow) {
      throw new ForbiddenError(`Access denied: ${decision.reasonCodes.join(',')}`);
    }
    if (decision.obligations.length > 0) {
      throw new ForbiddenError(`Obligations required: ${decision.obligations.join(',')}`);
    }
    return decision;
  }

  async listUsers(params: { principalId: string; actorUserId: string }) {
    await this.enforce({
      actorUserId: params.actorUserId,
      principalId: params.principalId,
      action: 'agent.user.manage',
    });
    return this.iamRepo.listMembershipsByPrincipal(params.principalId);
  }

  async assignUser(params: { principalId: string; actorUserId: string; userId: string; roleName: string; attributes?: Record<string, unknown> }) {
    await this.enforce({
      actorUserId: params.actorUserId,
      principalId: params.principalId,
      action: 'agent.user.manage',
      resourceId: params.userId,
    });
    const role = await this.iamRepo.findRoleByName(params.roleName);
    if (!role) {
      throw new ValidationError('Unknown role');
    }
    return this.iamRepo.createMembership({
      userId: params.userId,
      principalId: params.principalId,
      roleId: role.id,
      memberAttributes: params.attributes ?? {},
    });
  }

  async updateAttributes(params: { principalId: string; actorUserId: string; membershipId: string; attributes: Record<string, unknown> }) {
    await this.enforce({
      actorUserId: params.actorUserId,
      principalId: params.principalId,
      action: 'agent.user.manage',
      resourceId: params.membershipId,
    });
    return this.iamRepo.updateMembershipAttributes({ membershipId: params.membershipId, attributes: params.attributes });
  }

  async updateRole(params: { principalId: string; actorUserId: string; membershipId: string; roleName: string }) {
    await this.enforce({
      actorUserId: params.actorUserId,
      principalId: params.principalId,
      action: 'agent.role.manage',
      resourceId: params.membershipId,
    });
    const role = await this.iamRepo.findRoleByName(params.roleName);
    if (!role) {
      throw new ValidationError('Unknown role');
    }
    return this.iamRepo.updateMembershipRole({ membershipId: params.membershipId, roleId: role.id });
  }

  async simulate(params: { subject: { principalType: string; roles: string[]; principalId?: string; attributes?: Record<string, unknown> }; action: string; resource: { type: string; id?: string; attributes?: Record<string, unknown> }; context?: Record<string, unknown> }) {
    return this.policyService.evaluate(params.subject, params.action, params.resource, params.context ?? {});
  }
}
