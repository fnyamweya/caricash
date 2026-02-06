export declare class AppError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly details?: Record<string, unknown> | undefined;
    constructor(code: string, message: string, statusCode?: number, details?: Record<string, unknown> | undefined);
}
export declare class ConflictError extends AppError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class NotFoundError extends AppError {
    constructor(resource: string, id: string);
}
export declare class ValidationError extends AppError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class UnauthorizedError extends AppError {
    constructor(message?: string);
}
export declare class ForbiddenError extends AppError {
    constructor(message?: string);
}
export declare class IdempotencyConflictError extends ConflictError {
    constructor(key: string);
}
//# sourceMappingURL=errors.d.ts.map