"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotencyConflictError = exports.ForbiddenError = exports.UnauthorizedError = exports.ValidationError = exports.NotFoundError = exports.ConflictError = exports.AppError = void 0;
class AppError extends Error {
    code;
    statusCode;
    details;
    constructor(code, message, statusCode = 500, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
class ConflictError extends AppError {
    constructor(message, details) {
        super('CONFLICT', message, 409, details);
        this.name = 'ConflictError';
    }
}
exports.ConflictError = ConflictError;
class NotFoundError extends AppError {
    constructor(resource, id) {
        super('NOT_FOUND', `${resource} not found: ${id}`, 404);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class ValidationError extends AppError {
    constructor(message, details) {
        super('VALIDATION_ERROR', message, 400, details);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super('UNAUTHORIZED', message, 401);
        this.name = 'UnauthorizedError';
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super('FORBIDDEN', message, 403);
        this.name = 'ForbiddenError';
    }
}
exports.ForbiddenError = ForbiddenError;
class IdempotencyConflictError extends ConflictError {
    constructor(key) {
        super(`Idempotency key already used with different request: ${key}`, { key });
        this.name = 'IdempotencyConflictError';
    }
}
exports.IdempotencyConflictError = IdempotencyConflictError;
//# sourceMappingURL=errors.js.map