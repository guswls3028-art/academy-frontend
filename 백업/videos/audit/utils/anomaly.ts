// v1 기준: "위험 신호"만 표시 (판단/차단 ❌)

export const ANOMALY_EVENT_TYPES = new Set([
  "SEEK_ATTEMPT",
  "SPEED_CHANGE_ATTEMPT",
]);

export function isAnomalyEvent(type: string): boolean {
  return ANOMALY_EVENT_TYPES.has(type);
}
