// PATH: src/shared/media/video/videoFormat.ts

function formatHms(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatVideoBytes(bytes?: number): string {
  return bytes ? `${(Number(bytes) / 1024 / 1024).toFixed(1)} MB` : "\u2014";
}

export function formatVideoDuration(duration?: string | number | null): string | null {
  if (!duration) return null;
  const seconds = typeof duration === "string" ? parseInt(duration, 10) : duration;
  if (Number.isNaN(seconds) || seconds <= 0) return null;
  return formatHms(seconds);
}

export function formatRoundedVideoDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  return formatHms(Math.round(seconds));
}

export function formatVideoTimeAgo(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  if (diffSec < 60) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  if (diffWeek < 4) return `${diffWeek}주 전`;
  return `${Math.floor(diffDay / 30)}개월 전`;
}

export function formatVideoViewCount(count: number, includeUnit = false): string {
  if (count >= 10000) {
    const value = `${(count / 10000).toFixed(1).replace(/\.0$/, "")}만`;
    return includeUnit ? `${value} 회` : value;
  }
  if (count >= 1000) {
    const value = `${(count / 1000).toFixed(1).replace(/\.0$/, "")}천`;
    return includeUnit ? `${value} 회` : value;
  }
  return includeUnit ? `${count}회` : `${count}`;
}
