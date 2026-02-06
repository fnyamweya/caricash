import { AgentsService } from './agents.service';

jest.mock('@caricash/db', () => ({
  query: jest.fn(),
}));

const baseRepo = () => ({
  createPrincipal: jest.fn().mockResolvedValue({ id: 'principal-1' }),
  createAgent: jest.fn().mockResolvedValue({ id: 'agent-1', agent_number: 'AG-BB-001', level: 1, parent_agent_id: null, country_code: 'BB' }),
  findAgentById: jest.fn(),
  updateAgent: jest.fn().mockResolvedValue({ id: 'agent-1', status: 'ACTIVE', parent_agent_id: null, level: 1 }),
  listAgents: jest.fn(),
  getParentChain: jest.fn(),
});

describe('AgentsService hierarchy validation', () => {
  it('rejects parent levels beyond depth 3', async () => {
    const repo = baseRepo();
    repo.findAgentById.mockResolvedValue({ id: 'parent', level: 3, country_code: 'BB' });
    const service = new AgentsService(repo as any);

    await expect(
      service.createAgent({ countryCode: 'BB', displayName: 'Agent', level: 2, parentAgentId: 'parent' }),
    ).rejects.toThrow('Hierarchy depth exceeds max depth');
  });

  it('rejects hierarchy cycles', async () => {
    const repo = baseRepo();
    repo.findAgentById.mockResolvedValue({ id: 'parent', level: 1, country_code: 'BB' });
    repo.getParentChain.mockResolvedValue([{ id: 'agent-1', parent_agent_id: 'parent', level: 1, country_code: 'BB' }]);
    const service = new AgentsService(repo as any);

    await expect(
      service.updateAgent({ agentId: 'agent-1', parentAgentId: 'parent' }),
    ).rejects.toThrow('Hierarchy cycle detected');
  });

  it('allows valid hierarchy chains', async () => {
    const repo = baseRepo();
    repo.findAgentById.mockResolvedValue({ id: 'parent', level: 1, country_code: 'BB' });
    const service = new AgentsService(repo as any);

    const agent = await service.createAgent({ countryCode: 'BB', displayName: 'Agent', level: 2, parentAgentId: 'parent' });
    expect(agent.id).toBe('agent-1');
  });

  it('property test: random depths never exceed max', async () => {
    for (let i = 0; i < 20; i++) {
      const repo = baseRepo();
      const parentLevel = Math.floor(Math.random() * 5) + 1;
      repo.findAgentById.mockResolvedValue({ id: 'parent', level: parentLevel, country_code: 'BB' });
      const service = new AgentsService(repo as any);

      const shouldFail = parentLevel >= 3;
      if (shouldFail) {
        await expect(
          service.createAgent({ countryCode: 'BB', displayName: 'Agent', level: parentLevel + 1, parentAgentId: 'parent' }),
        ).rejects.toThrow();
      } else {
        await service.createAgent({ countryCode: 'BB', displayName: 'Agent', level: parentLevel + 1, parentAgentId: 'parent' });
      }
    }
  });
});
