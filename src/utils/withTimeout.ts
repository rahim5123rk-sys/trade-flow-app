export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

interface WithAbortTimeoutOptions {
  timeoutMs: number;
  label: string;
}

export async function withAbortTimeout<T>(
  operation: (context: {signal: AbortSignal}) => Promise<T>,
  {timeoutMs, label}: WithAbortTimeoutOptions,
): Promise<T> {
  const controller = new AbortController();
  let didTimeout = false;

  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort(new TimeoutError(`${label} timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    return await operation({signal: controller.signal});
  } catch (error) {
    if (didTimeout) {
      throw controller.signal.reason instanceof Error
        ? controller.signal.reason
        : new TimeoutError(`${label} timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}