/**
 * Offline mutation queue.
 * Persists pending mutations to AsyncStorage and replays them when connectivity returns.
 * Uses AppState to detect foreground transitions as a proxy for reconnection.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';

const QUEUE_KEY = 'offline_mutation_queue';

export interface QueuedMutation {
  id: string;
  createdAt: string;
  /** RPC function name or table.operation */
  operation: string;
  /** Arguments to the RPC or query */
  params: Record<string, any>;
  /** Number of retry attempts so far */
  retries: number;
}

/**
 * Load the pending queue from storage.
 */
async function loadQueue(): Promise<QueuedMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save the queue back to storage.
 */
async function saveQueue(queue: QueuedMutation[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Add a mutation to the offline queue.
 */
export async function enqueueMutation(
  operation: string,
  params: Record<string, any>,
): Promise<void> {
  const queue = await loadQueue();
  const mutation: QueuedMutation = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    operation,
    params,
    retries: 0,
  };
  queue.push(mutation);
  await saveQueue(queue);
}

/**
 * Get the count of pending mutations.
 */
export async function getPendingCount(): Promise<number> {
  const queue = await loadQueue();
  return queue.length;
}

/**
 * Process the queue. Called when connectivity is restored.
 * @param executor - Function that takes an operation name and params, executes it via Supabase
 * @returns Results of processing
 */
export async function processQueue(
  executor: (operation: string, params: Record<string, any>) => Promise<boolean>,
): Promise<{ processed: number; failed: number }> {
  const queue = await loadQueue();
  if (queue.length === 0) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;
  const remaining: QueuedMutation[] = [];

  for (const mutation of queue) {
    try {
      const success = await executor(mutation.operation, mutation.params);
      if (success) {
        processed++;
      } else {
        mutation.retries++;
        if (mutation.retries < 5) {
          remaining.push(mutation);
        }
        failed++;
      }
    } catch {
      mutation.retries++;
      if (mutation.retries < 5) {
        remaining.push(mutation);
      }
      failed++;
    }
  }

  await saveQueue(remaining);
  return { processed, failed };
}

/**
 * Clear all pending mutations.
 */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

/**
 * Start listening for app foreground events and auto-process queue.
 * When the app comes back to foreground, attempts to flush pending mutations.
 * Returns unsubscribe function.
 */
export function startQueueProcessor(
  executor: (operation: string, params: Record<string, any>) => Promise<boolean>,
): () => void {
  let processing = false;

  const handleAppState = async (nextState: AppStateStatus) => {
    if (nextState === 'active' && !processing) {
      processing = true;
      try {
        const { processed, failed } = await processQueue(executor);
        if (processed > 0) {
          console.log(`[OfflineQueue] Synced ${processed} mutations, ${failed} failed`);
        }
      } catch (e) {
        console.warn('[OfflineQueue] Process error:', e);
      } finally {
        processing = false;
      }
    }
  };

  const subscription = AppState.addEventListener('change', handleAppState);

  // Also try immediately on start
  void handleAppState('active');

  return () => subscription.remove();
}
