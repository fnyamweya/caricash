export const ABAC_ATTRIBUTE_WHITELIST = [
  'max_refund_amount',
  'max_cashout_amount',
  'max_cashin_amount',
  'daily_limit',
  'refund_minutes',
  'allowed_tills',
  'allowed_stores',
  'allowed_agents',
  'allowed_channels',
  'device_binding',
] as const;

export type AbacAttributeKey = (typeof ABAC_ATTRIBUTE_WHITELIST)[number];
