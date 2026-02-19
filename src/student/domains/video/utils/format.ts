// PATH: src/student/domains/video/utils/format.ts
/**
 * 비디오 도메인 공통 유틸리티 함수
 */

/**
 * 초를 시간 형식으로 변환 (예: "1시간 30분", "45분")
 */
export function formatDuration(sec: number | null | undefined): string {
  if (sec == null || sec <= 0) return "0분";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

/**
 * 초를 시:분:초 형식으로 변환 (예: "1:30:45", "45:30")
 */
export function formatDurationDetailed(sec: number | null | undefined): string {
  if (sec == null || sec <= 0) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
