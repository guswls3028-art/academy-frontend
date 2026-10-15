import type { PublicVideo, VideoContent, VideoSort } from "../api/publicVideos";

export const videoSortLabels: Record<VideoSort, string> = { latest: "최신순", popular: "인기순", oldest: "오래된순" };

export function videoBrowseQuery(format: VideoContent["format"], sort: VideoSort, q = "", page = 1) {
  const params = new URLSearchParams({ format, sort });
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  return `?${params}`;
}

export function videoDateLabel(video: PublicVideo) {
  const value = video.youtube_published_at || video.published_at;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const formatted = date.toLocaleDateString("ko-KR", { year: "numeric", month: "numeric", day: "numeric" });
  return `${video.youtube_published_at ? "" : "홈페이지 공개 "}${formatted}`;
}

export function videoViewLabel(video: PublicVideo) {
  return video.youtube_view_count != null ? `YouTube 조회수 ${video.youtube_view_count.toLocaleString("ko-KR")}회` : "YouTube 조회수 미확인";
}
