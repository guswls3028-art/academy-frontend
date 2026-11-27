import { createContext, type ReactNode } from 'react';

type ScheduleControls = {
  content: ReactNode;
  title: string;
  date: string;
  inlineActions: boolean;
  blockedNotice: ReactNode;
  needsScheduleRecovery: boolean;
  managementPending: boolean;
  managementQueued: boolean;
  openManager: () => void;
  prepareTransition: (onReady: () => void) => Promise<void>;
};

export const SessionScheduleControlsContext = createContext<ScheduleControls | null>(null);
