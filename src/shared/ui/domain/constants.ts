// PATH: src/shared/ui/domain/constants.ts
// Design SSOT — 색상 상수 (태그·아이콘·꼬리표 등 공통)

/** 활성 상태 — 초록 */
export const STATUS_ACTIVE_COLOR = "#22c55e";

/** 비활성 상태 — 빨강 */
export const STATUS_INACTIVE_COLOR = "#ef4444";

/** 프리셋 색상 (태그·강의 아이콘·꼬리표 등) */
export const PRESET_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#6366f1",
  "#14b8a6",
] as const;

/** 프리셋 기본값 (첫 번째) */
export const DEFAULT_PRESET_COLOR = PRESET_COLORS[0];

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/** 사용 중인 색상과 최대한 차이나는 프리셋을 기본값으로 반환 */
export function getDefaultColorForPicker(usedColors: string[]): string {
  const used = usedColors.filter(Boolean);
  if (used.length === 0) return DEFAULT_PRESET_COLOR;

  let best = PRESET_COLORS[0];
  let bestMinDist = -1;

  for (const preset of PRESET_COLORS) {
    const minDist = Math.min(...used.map((c) => colorDistance(preset, c)));
    if (minDist > bestMinDist) {
      bestMinDist = minDist;
      best = preset;
    }
  }
  return best;
}
