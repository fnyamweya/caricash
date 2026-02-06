import { AppError, ConflictError, NotFoundError, ValidationError, UnauthorizedError, IdempotencyConflictError } from './errors';

describe('Errors', () => {
  it('AppError has correct properties', () => {
    const err = new AppError('TEST', 'test message', 500);
    expect(err.code).toBe('TEST');
    expect(err.message).toBe('test message');
    expect(err.statusCode).toBe(500);
    expect(err).toBeInstanceOf(Error);
  });

  it('ConflictError has 409 status', () => {
    const err = new ConflictError('conflict');
    expect(err.statusCode).toBe(409);
  });

  it('NotFoundError has 404 status', () => {
    const err = new NotFoundError('User', '123');
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain('123');
  });

  it('ValidationError has 400 status', () => {
    const err = new ValidationError('bad input');
    expect(err.statusCode).toBe(400);
  });

  it('UnauthorizedError has 401 status', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
  });

  it('IdempotencyConflictError includes key', () => {
    const err = new IdempotencyConflictError('key-123');
    expect(err.statusCode).toBe(409);
    expect(err.message).toContain('key-123');
  });
});
