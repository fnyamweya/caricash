import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
  it('enforces limits per key', async () => {
    const service = new RateLimitService();
    const key = 'signup:test';

    const first = await service.checkLimit({ key, limit: 2, windowSeconds: 60 });
    const second = await service.checkLimit({ key, limit: 2, windowSeconds: 60 });
    const third = await service.checkLimit({ key, limit: 2, windowSeconds: 60 });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
  });
});
