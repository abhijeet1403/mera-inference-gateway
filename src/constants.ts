/** Default RedPill AI model — configurable via DEFAULT_MODEL env var */
export const DEFAULT_MODEL = 'phala/qwen3-vl-30b-a3b-instruct';

/** Default temperature for LLM inference */
export const DEFAULT_LLM_TEMPERATURE = 0.1;

/** RedPill AI API base URL */
export const REDPILL_BASE_URL = 'https://api.redpill.ai/v1';

/** Expected JWT issuer claim — must match the auth service's jwt() plugin config */
export const JWT_ISSUER = 'mera-server-auth';
