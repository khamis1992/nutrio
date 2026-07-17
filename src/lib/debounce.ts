// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DebouncedFunction<T extends (...args: any[]) => void> =
  ((...args: Parameters<T>) => void) & { cancel: () => void };

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      func(...args);
    }, wait);
  };

  debounced.cancel = () => {
    if (!timeoutId) return;
    clearTimeout(timeoutId);
    timeoutId = null;
  };

  return debounced;
}
