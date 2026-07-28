export function appendSerialTask<T>(
  tail: Promise<void>,
  task: () => Promise<T>,
  onSuccess: (value: T) => void,
  onError: (error: unknown) => void,
): Promise<void> {
  return tail
    .catch(() => undefined)
    .then(task)
    .then(
      (value) => onSuccess(value),
      (error: unknown) => onError(error),
    );
}
