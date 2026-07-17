export type AllocationNow = () => number;

export interface AllocationExecutionBudget {
  check(stage: string): void;
  run<T>(
    stage: string,
    operation: (signal: AbortSignal) => PromiseLike<T> | Promise<T>,
  ): Promise<T>;
}

export type AllocationBudgetErrorFactory = (stage: string) => Error;

function defaultBudgetError(stage: string): Error {
  return Object.assign(
    new Error("Meal allocation exceeded its execution budget"),
    {
      name: "AllocationBudgetExceededError",
      status: 503,
      code: "allocation_budget_exceeded",
      stage,
    },
  );
}

export function createAllocationExecutionBudget(
  maxRuntimeMs: number,
  now: AllocationNow = Date.now,
  parentSignal?: AbortSignal,
  createError: AllocationBudgetErrorFactory = defaultBudgetError,
): AllocationExecutionBudget {
  const expiresAt = now() + maxRuntimeMs;

  const remainingMs = () => expiresAt - now();
  const check = (stage: string) => {
    if (remainingMs() <= 0) throw createError(stage);
  };

  const run = async <T>(
    stage: string,
    operation: (signal: AbortSignal) => PromiseLike<T> | Promise<T>,
  ): Promise<T> => {
    const remaining = remainingMs();
    if (remaining <= 0) throw createError(stage);

    const controller = new AbortController();
    let timedOut = false;
    const abortFromParent = () => controller.abort(parentSignal?.reason);

    if (parentSignal?.aborted) {
      abortFromParent();
    } else {
      parentSignal?.addEventListener("abort", abortFromParent, { once: true });
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort("allocation_budget_exceeded");
        reject(createError(stage));
      }, remaining);
    });

    try {
      const operationResult = Promise.resolve().then(() => operation(controller.signal));
      return await Promise.race([operationResult, timeout]);
    } catch (error) {
      if (timedOut || remainingMs() <= 0) throw createError(stage);
      throw error;
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      parentSignal?.removeEventListener("abort", abortFromParent);
    }
  };

  return { check, run };
}
