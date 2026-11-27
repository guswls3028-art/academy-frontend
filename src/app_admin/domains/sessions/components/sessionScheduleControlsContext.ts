import { createContext, type ReactNode } from 'react';
import type { SessionScheduleAction } from '@/shared/hooks/useSessionScheduleScope';

type ScheduleControls = {
  content: ReactNode;
  rosterDayPicker: ReactNode;
  title: string;
  date: string;
  inlineActions: boolean;
  blockedNotice: ReactNode;
  needsScheduleRecovery: boolean;
  managementPending: boolean;
  managementQueued: boolean;
  openManager: () => void;
  prepareTransition: (onReady: () => void, action?: SessionScheduleAction) => Promise<void>;
};

export const SessionScheduleControlsContext = createContext<ScheduleControls | null>(null);
