"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCorrelationId = generateCorrelationId;
exports.generateRequestId = generateRequestId;
const uuid_1 = require("uuid");
/**
 * Generate a new correlation ID.
 */
function generateCorrelationId() {
    return (0, uuid_1.v4)();
}
/**
 * Generate a new request ID.
 */
function generateRequestId() {
    return (0, uuid_1.v4)();
}
//# sourceMappingURL=correlation.js.map