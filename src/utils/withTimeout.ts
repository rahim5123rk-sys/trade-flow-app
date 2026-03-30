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

/**
 * Race any promise/thenable against a timeout. If the timeout fires first, returns null.
 * Use for Supabase client queries that don't support AbortController.
 * Wraps thenables (like PostgREST builders) into proper Promises automatically.
 */
export function withQueryTimeout<T>(
  promiseOrThenable: PromiseLike<T>,
  timeoutMs: number = 10000,
): Promise<T | null> {
  // Explicitly wrap in Promise.resolve to handle Supabase's thenable builders
  return Promise.race([
    Promise.resolve(promiseOrThenable),
    new Promise<null>((resolve) => setTimeout(() => {
      console.warn(`[QueryTimeout] Query did not complete within ${timeoutMs}ms`);
      resolve(null);
    }, timeoutMs)),
  ]);
}