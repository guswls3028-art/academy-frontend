export function matchupHitRateLabel(rate: number | null | undefined): string | null {
  if (typeof rate !== "number" || !Number.isFinite(rate)) return null;
  const percentage = Math.round(Math.max(0, rate) * 1000) / 10;
  return Number.isInteger(percentage) ? `${percentage.toFixed(0)}%` : `${percentage.toFixed(1)}%`;
}
