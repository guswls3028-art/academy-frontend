import { useSearchParams } from 'react-router';
import { createContext, useContext, useEffect, type MutableRefObject } from 'react';

export type SessionScheduleAction = 'view' | 'manage';
export type SessionScheduleGuard = (action: SessionScheduleAction) => Promise<boolean>;

export const SessionScheduleNavigationContext = createContext<MutableRefObject<SessionScheduleGuard | undefined> | null>(null);

export function useBeforeScheduleChange(guard: SessionScheduleGuard) {
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
