export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export interface RetryOptions {
  /** 重试次数（不含首次请求）。 */
  retries?: number;
  /** 首次重试间隔，后续按次数线性增长。 */
  delayMs?: number;
  /** 每次重试前的回调，便于打印日志。 */
  onRetry?: (attempt: number, error: unknown) => void;
  /** 返回 false 时不重试，直接抛出。 */
  shouldRetry?: (error: unknown) => boolean;
}

/** 带退避的重试封装。 */
export async function withRetry<T>(task: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { retries = 2, delayMs = 2_000, onRetry, shouldRetry } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      if (shouldRetry && !shouldRetry(error)) break;
      onRetry?.(attempt + 1, error);
      await sleep(delayMs * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** 限制并发地映射数组，保持结果顺序。 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      const item = items[index];
      if (item === undefined) return;
      results[index] = await mapper(item, index);
    }
  };

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
