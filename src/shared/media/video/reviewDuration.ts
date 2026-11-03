export function originalDurationSeconds(input: string): number | null {
  const match = /^(\d{1,6})(?::([0-5]\d))?$/.exec(input.trim());
  if (!match) return null;
  const seconds = Number(match[1]) * 60 + Number(match[2] || 0);
  return seconds > 0 ? seconds : null;
}

export function reviewLimitLabel(seconds: number) {
  const tenths = seconds * 14;
  return `${Math.floor(tenths / 600)}분 ${(tenths % 600) / 10}초`;
}
