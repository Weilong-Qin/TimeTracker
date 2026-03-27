export interface RetryBackoffPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface RetryAttemptInfo {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  error: Error;
}

export interface RetryExecutionOptions {
  policy?: Partial<RetryBackoffPolicy>;
  sleep?: (ms: number) => Promise<void>;
  shouldRetry?: (error: Error) => boolean;
  onRetry?: (info: RetryAttemptInfo) => void;
}

const DEFAULT_RETRY_BACKOFF_POLICY: RetryBackoffPolicy = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

function resolvePositiveNumber(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function resolveRetryCount(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return Math.floor(value);
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(typeof error === 'string' ? error : 'unknown error');
}

function computeDelayMs(policy: RetryBackoffPolicy, failureCount: number): number {
  const factor = Math.max(1, policy.backoffMultiplier);
  const delay = policy.baseDelayMs * factor ** Math.max(0, failureCount - 1);
  return Math.min(policy.maxDelayMs, Math.max(1, Math.floor(delay)));
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resolvePolicy(input?: Partial<RetryBackoffPolicy>): RetryBackoffPolicy {
  const maxDelayMs = resolvePositiveNumber(input?.maxDelayMs, DEFAULT_RETRY_BACKOFF_POLICY.maxDelayMs);

  return {
    maxRetries: resolveRetryCount(input?.maxRetries, DEFAULT_RETRY_BACKOFF_POLICY.maxRetries),
    baseDelayMs: Math.min(
      maxDelayMs,
      resolvePositiveNumber(input?.baseDelayMs, DEFAULT_RETRY_BACKOFF_POLICY.baseDelayMs),
    ),
    maxDelayMs,
    backoffMultiplier: resolvePositiveNumber(
      input?.backoffMultiplier,
      DEFAULT_RETRY_BACKOFF_POLICY.backoffMultiplier,
    ),
  };
}

export async function runWithRetry<T>(
  operation: () => Promise<T>,
  options?: RetryExecutionOptions,
): Promise<T> {
  const policy = resolvePolicy(options?.policy);
  const maxAttempts = policy.maxRetries + 1;
  const sleep = options?.sleep ?? defaultSleep;
  const shouldRetry = options?.shouldRetry ?? (() => true);

  let failureCount = 0;
  while (failureCount < maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      const normalizedError = toError(error);
      failureCount += 1;

      if (failureCount >= maxAttempts || !shouldRetry(normalizedError)) {
        throw normalizedError;
      }

      const delayMs = computeDelayMs(policy, failureCount);
      options?.onRetry?.({
        attempt: failureCount,
        maxAttempts,
        delayMs,
        error: normalizedError,
      });
      await sleep(delayMs);
    }
  }

  throw new Error('retry loop exhausted unexpectedly');
}
