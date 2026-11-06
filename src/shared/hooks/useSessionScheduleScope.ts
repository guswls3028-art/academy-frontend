import { useSearchParams } from 'react-router';
import { createContext, useContext, useEffect, type MutableRefObject } from 'react';

export const SessionScheduleNavigationContext = createContext<MutableRefObject<(() => Promise<boolean>) | undefined> | null>(null);

export function useBeforeScheduleChange(guard: () => Promise<boolean>) {
  const ref = useContext(SessionScheduleNavigationContext);
  useEffect(() => {
    if (!ref) return;
    ref.current = guard;
    return () => { if (ref.current === guard) ref.current = undefined; };
  }, [ref, guard]);
}

/** Keep even invalid URL values scoped: the server rejects them, never falls back to all. */
export function useSessionScheduleScope() {
  const [params] = useSearchParams();
  return params.get('schedule') ?? undefined;
}
