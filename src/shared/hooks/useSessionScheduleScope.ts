import { useSearchParams } from 'react-router';
import { createContext, useContext, useLayoutEffect, type MutableRefObject } from 'react';

export type SessionScheduleAction = 'view' | 'manage';
export type SessionScheduleGuard = (action: SessionScheduleAction) => Promise<boolean>;

export type ScheduleManagementReadiness = "pending" | "ready" | "blocked";

type SessionScheduleNavigation = {
  beforeChange: MutableRefObject<SessionScheduleGuard | undefined>;
  setManagementReadiness: (readiness: ScheduleManagementReadiness) => void;
};

export const SessionScheduleNavigationContext = createContext<SessionScheduleNavigation | null>(null);

export function useBeforeScheduleChange(guard: SessionScheduleGuard, managementReadiness: ScheduleManagementReadiness) {
  const navigation = useContext(SessionScheduleNavigationContext);
  useLayoutEffect(() => {
    if (!navigation) return;
    const { beforeChange } = navigation;
    beforeChange.current = guard;
    return () => { if (beforeChange.current === guard) beforeChange.current = undefined; };
  }, [navigation, guard]);

  useLayoutEffect(() => {
    if (!navigation) return;
    navigation.setManagementReadiness(managementReadiness);
    return () => navigation.setManagementReadiness("ready");
  }, [navigation, managementReadiness]);
}

/** Keep even invalid URL values scoped: the server rejects them, never falls back to all. */
export function useSessionScheduleScope() {
  const [params] = useSearchParams();
  return params.get('schedule') ?? undefined;
}
