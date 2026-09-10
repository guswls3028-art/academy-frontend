export type SerialProofGate = <T>(proof: () => Promise<T>) => Promise<T>;

/**
 * Run one destructive/navigation proof at a time. The first failure poisons
 * the queue so a later proof cannot start while failure capture is closing
 * browser contexts.
 */
export function createSerialProofGate(): SerialProofGate {
  let tail: Promise<void> = Promise.resolve();
  let failed = false;
  let firstFailure: unknown;

  return <T>(proof: () => Promise<T>) => {
    const current = tail.then(async () => {
      if (failed) throw firstFailure;
      try {
        return await proof();
      } catch (error) {
        failed = true;
        firstFailure = error;
        throw error;
      }
    });
    tail = current.then(() => undefined, () => undefined);
    return current;
  };
}
