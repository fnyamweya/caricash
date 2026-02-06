import { Injectable } from '@nestjs/common';
import { queryOne, queryMany } from '@caricash/db';

export interface PrincipalRow {
  id: string;
  principal_type: string;
  country_code: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface AgentRow {
  id: string;
  principal_id: string;
  country_code: string;
  agent_number: string;
  level: number;
  parent_agent_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AgentChainRow {
  id: string;
  parent_agent_id: string | null;
  level: number;
  country_code: string;
}

@Injectable()
export class AgentsRepository {
  async createPrincipal(params: { principalType: string; countryCode: string; displayName: string }): Promise<PrincipalRow | null> {
    return queryOne<PrincipalRow>(
      `INSERT INTO principals (principal_type, country_code, display_name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [params.principalType, params.countryCode, params.displayName],
    );
  }

  async createAgent(
    params: { principalId: string; countryCode: string; agentNumber: string; level: number; parentAgentId?: string | null },
  ): Promise<AgentRow | null> {
    return queryOne<AgentRow>(
      `INSERT INTO agents (principal_id, country_code, agent_number, level, parent_agent_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [params.principalId, params.countryCode, params.agentNumber, params.level, params.parentAgentId ?? null],
    );
  }

  async findAgentById(agentId: string): Promise<AgentRow | null> {
    return queryOne<AgentRow>('SELECT * FROM agents WHERE id = $1', [agentId]);
  }

  async updateAgent(params: { agentId: string; status?: string; parentAgentId?: string | null; level?: number }): Promise<AgentRow | null> {
    return queryOne<AgentRow>(
      `UPDATE agents
       SET status = COALESCE($1, status),
           parent_agent_id = COALESCE($2, parent_agent_id),
           level = COALESCE($3, level),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [params.status ?? null, params.parentAgentId ?? null, params.level ?? null, params.agentId],
    );
  }

  async listAgents(filters: { countryCode?: string; status?: string }): Promise<AgentRow[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (filters.countryCode) {
      values.push(filters.countryCode);
      conditions.push(`country_code = $${values.length}`);
    }
    if (filters.status) {
      values.push(filters.status);
      conditions.push(`status = $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return queryMany<AgentRow>(`SELECT * FROM agents ${where} ORDER BY created_at DESC`, values);
  }

  async getParentChain(agentId: string): Promise<AgentChainRow[]> {
    return queryMany<AgentChainRow>(
      `WITH RECURSIVE chain AS (
         SELECT id, parent_agent_id, level, country_code FROM agents WHERE id = $1
         UNION ALL
         SELECT a.id, a.parent_agent_id, a.level, a.country_code
         FROM agents a
         JOIN chain c ON c.parent_agent_id = a.id
       )
       SELECT * FROM chain`,
      [agentId],
    );
  }
}
