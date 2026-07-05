// PATH: src/app_admin/domains/tools/stopwatch/stopwatchTime.ts

export type StopwatchTimeParts = {
  h: string;
  m: string;
  s: string;
  cs: string;
};

export function padStopwatchPart(value: number, digits = 2): string {
  return String(value).padStart(digits, "0");
}

export function getStopwatchTimeParts(
  ms: number,
  options: { clamp?: boolean } = {}
): StopwatchTimeParts {
  const total = options.clamp ? Math.max(0, Math.floor(ms)) : Math.floor(ms);
  return {
    h: padStopwatchPart(Math.floor(total / 3600000)),
    m: padStopwatchPart(Math.floor((total % 3600000) / 60000)),
    s: padStopwatchPart(Math.floor((total % 60000) / 1000)),
    cs: padStopwatchPart(Math.floor((total % 1000) / 10)),
  };
}

export function toStopwatchTimeText(ms: number, options: { clamp?: boolean } = {}): string {
  const parts = getStopwatchTimeParts(ms, options);
  return `${parts.h}:${parts.m}:${parts.s}.${parts.cs}`;
}
