import { createContext, type ReactNode } from 'react';

type ScheduleControls = {
  content: ReactNode;
  title: string;
  date: string;
  blockedNotice: ReactNode;
  openManager: () => void;
};

export const SessionScheduleControlsContext = createContext<ScheduleControls | null>(null);
