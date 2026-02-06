"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEffectiveRecord = resolveEffectiveRecord;
function resolveEffectiveRecord(records, now = new Date()) {
    const today = now.toISOString().slice(0, 10);
    return (records.find((record) => {
        const status = record.status ?? 'ACTIVE';
        const effectiveFrom = record.effective_from ?? record.effectiveFrom ?? today;
        return status === 'ACTIVE' && effectiveFrom <= today;
    }) ?? null);
}
//# sourceMappingURL=config.js.map