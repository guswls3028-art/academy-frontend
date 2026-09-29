import { createContext } from "react";

export type TimerPhase = "setup" | "ready" | "running" | "paused" | "finished";
export type TimerFontKey = "mono" | "classic" | "modern" | "round";

interface TimerSnapshot {
  phase: TimerPhase;
  remaining: number;
  endTime: number;
  totalSet: number;
  fontKey: TimerFontKey;
  inputMin: string;
  inputSec: string;
}

export interface StopwatchLap {
  n: number;
  split: number;
  total: number;
}

interface StopwatchSnapshot {
  running: boolean;
  elapsedBase: number;
  startTime: number;
  lastLap: number;
  laps: StopwatchLap[];
}

export interface StopwatchSession {
  timer: TimerSnapshot | null;
  stopwatch: StopwatchSnapshot | null;
  mode: "timer" | "stopwatch";
  projector: boolean;
}

export const StopwatchSessionContext = createContext<{ pathname: string; current: StopwatchSession } | null>(null);
