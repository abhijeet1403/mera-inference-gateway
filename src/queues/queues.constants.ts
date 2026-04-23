export const LLM_INFERENCE_QUEUE = 'llm-inference';
export const FINALIZE_JOB_QUEUE = 'finalize-job';
export const NOTIFY_USER_QUEUE = 'notify-user';
export const INFERENCE_FLOW_PRODUCER = 'inference-flow';

/** Default opts applied to every BullMQ job (including Flow children + parent).
 *  Closes the parent-job leak that existed when the original flow had no
 *  removeOnComplete/removeOnFail on the parent. */
export const DEFAULT_JOB_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: { age: 3600, count: 500 },
  removeOnFail: { age: 86400 },
};
