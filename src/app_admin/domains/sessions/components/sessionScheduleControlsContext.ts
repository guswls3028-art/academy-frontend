import { createContext, type ReactNode } from 'react';

type ScheduleControls = {
  content: ReactNode;
  blockedNotice: ReactNode;
  openManager: () => void;
};

export const SessionScheduleControlsContext = createContext<ScheduleControls | null>(null);
