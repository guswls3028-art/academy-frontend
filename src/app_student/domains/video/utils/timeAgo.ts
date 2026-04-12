/** 상대 시간 포맷 (한국어) */
export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return "";
  const diff = now - then;
  if (diff < 0) return "방금";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}개월 전`;
  return `${Math.floor(month / 12)}년 전`;
}

/** 조회수 포맷 (1만 이상이면 '1.2만회' 형태) */
export function formatViewCount(count: number | null | undefined): string {
  if (count == null || count <= 0) return "조회수 0회";
  if (count < 10000) return `조회수 ${count.toLocaleString()}회`;
  const wan = count / 10000;
  return `조회수 ${wan < 10 ? wan.toFixed(1) : Math.floor(wan)}만회`;
}
