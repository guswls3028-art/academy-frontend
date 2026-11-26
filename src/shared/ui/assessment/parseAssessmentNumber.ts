/** Preserve number-input decimal/exponent syntax without coercing blank to 0. */
export function parseAssessmentNumber(value: string): number {
  const text = value.trim();
  return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text) ? Number(text) : NaN;
}
