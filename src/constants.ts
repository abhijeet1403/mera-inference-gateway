/** E2EE provider upstream endpoints. Each backend speaks a different wire
 *  protocol but this gateway is a pure proxy — it never inspects ciphertext,
 *  only forwards requests and replies. */
export const REDPILL_BASE_URL = 'https://api.redpill.ai/v1';
export const NEARAI_BASE_URL = 'https://cloud-api.near.ai/v1';

export type ProviderName = 'redpill' | 'nearai';

/** Expected JWT issuer claim — must match the auth service's jwt() plugin config */
export const JWT_ISSUER = 'mera-server-auth';
