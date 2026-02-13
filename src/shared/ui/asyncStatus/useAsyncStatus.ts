// PATH: src/shared/ui/asyncStatus/useAsyncStatus.ts
import { useEffect, useState } from "react";
import { asyncStatusStore, type AsyncTask } from "./asyncStatusStore";

export function useAsyncStatus(): AsyncTask[] {
  const [state, setState] = useState<AsyncTask[]>(() => asyncStatusStore.getState());

  useEffect(() => {
    return asyncStatusStore.subscribe(setState);
  }, []);

  return state;
}

export { asyncStatusStore };
