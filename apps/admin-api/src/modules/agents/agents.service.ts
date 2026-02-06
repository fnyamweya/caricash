import { Injectable } from '@nestjs/common';
import { AgentsRepository } from './agents.repository';
import { ConflictError, ValidationError } from '@caricash/common';
import { randomBytes } from 'crypto';
import { query } from '@caricash/db';
import { EventTypes } from '@caricash/events';

@Injectable()
export class AgentsService {
  constructor(private readonly repo: AgentsRepository) {}

  async createAgent(params: { countryCode: string; displayName: string; level?: number; parentAgentId?: string | null; correlationId?: string }) {
    const level = params.level ?? 1;
    await this.validateHierarchy({ parentAgentId: params.parentAgentId, level, countryCode: params.countryCode });

    const principal = await this.repo.createPrincipal({
      principalType: 'AGENT',
      countryCode: params.countryCode,
      displayName: params.displayName,
    });

    const agentNumber = this.generateAgentNumber(params.countryCode);
    const agent = await this.repo.createAgent({
      principalId: principal.id,
      countryCode: params.countryCode,
      agentNumber,
      level,
      parentAgentId: params.parentAgentId ?? null,
    });

    await query(
      `INSERT INTO outbox_events (event_type, correlation_id, payload)
       VALUES ($1, $2, $3)`,
      [
        EventTypes.AGENT_CREATED,
        params.correlationId ?? null,
        JSON.stringify({ agentId: agent.id, principalId: principal.id, agentNumber: agent.agent_number, level: agent.level, parentAgentId: agent.parent_agent_id, countryCode: agent.country_code }),
      ],
    );

    return agent;
  }

  async updateAgent(params: { agentId: string; status?: string; parentAgentId?: string | null; level?: number; correlationId?: string }) {
    const current = await this.repo.findAgentById(params.agentId);
    if (!current) {
      throw new ValidationError('Agent not found');
    }
    const newLevel = params.level ?? current.level;
    const newParent = params.parentAgentId ?? current.parent_agent_id;
    await this.validateHierarchy({ agentId: params.agentId, parentAgentId: newParent, level: newLevel, countryCode: current.country_code });

    const agent = await this.repo.updateAgent({
      agentId: params.agentId,
      status: params.status,
      parentAgentId: params.parentAgentId,
      level: params.level,
    });

    await query(
      `INSERT INTO outbox_events (event_type, correlation_id, payload)
       VALUES ($1, $2, $3)`,
      [
        EventTypes.AGENT_UPDATED,
        params.correlationId ?? null,
        JSON.stringify({ agentId: agent?.id, status: agent?.status, parentAgentId: agent?.parent_agent_id, level: agent?.level }),
      ],
    );

    return agent;
  }

  async listAgents(filters: { countryCode?: string; status?: string }) {
    return this.repo.listAgents(filters);
  }

  private async validateHierarchy(params: { agentId?: string; parentAgentId?: string | null; level: number; countryCode: string }) {
    if (params.level < 1 || params.level > 3) {
      throw new ValidationError('Agent level must be between 1 and 3');
    }
    if (!params.parentAgentId) return;

    const parent = await this.repo.findAgentById(params.parentAgentId);
    if (!parent) {
      throw new ValidationError('Parent agent not found');
    }
    if (parent.country_code !== params.countryCode) {
      throw new ConflictError('Cross-country hierarchy not allowed');
    }
    if (parent.level >= 3 || parent.level + 1 > 3 || params.level > parent.level + 1) {
      throw new ValidationError('Hierarchy depth exceeds max depth');
    }

    if (params.agentId) {
      const chain = await this.repo.getParentChain(params.parentAgentId);
      if (chain.find((node) => node.id === params.agentId)) {
        throw new ValidationError('Hierarchy cycle detected');
      }
    }
  }

  private generateAgentNumber(countryCode: string) {
    const suffix = randomBytes(3).toString('hex').toUpperCase();
    return `AG-${countryCode}-${suffix}`;
  }
}
