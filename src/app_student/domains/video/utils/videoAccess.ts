import type { AccessMode, VideoStatus } from "@/shared/api/contracts/videos";
import {
  isVideoProgressComplete,
  videoProgressPercent,
} from "@/shared/api/contracts/videos";
import type { StudentVideoListItem } from "../api/video.api";

const READY_STATUS: VideoStatus = "READY";

export function isStudentVideoReady(video: Pick<StudentVideoListItem, "status">): boolean {
  return (video.status ?? READY_STATUS) === READY_STATUS;
}

export function isStudentVideoBlocked(video: Pick<StudentVideoListItem, "access_mode">): boolean {
  return video.access_mode === "BLOCKED";
}

export function canPlayStudentVideo(video: Pick<StudentVideoListItem, "status" | "access_mode">): boolean {
  return isStudentVideoReady(video) && !isStudentVideoBlocked(video);
}

export function studentVideoProgressPercent(video: Pick<StudentVideoListItem, "progress">): number {
  return videoProgressPercent(video.progress ?? 0);
}

export function isStudentVideoComplete(
  video: Pick<StudentVideoListItem, "progress" | "completed">,
): boolean {
  return isVideoProgressComplete(video.progress ?? 0, video.completed);
}

export function studentVideoAccessLabel(accessMode?: AccessMode | null): string {
  if (accessMode === "BLOCKED") return "시청 제한";
  if (accessMode === "PROCTORED_CLASS") return "수업 모드";
  if (accessMode === "FREE_REVIEW") return "복습 가능";
  return "재생 가능";
}

export function studentVideoUnavailableLabel(status?: string | null, accessMode?: AccessMode | null): string {
  if (accessMode === "BLOCKED") return "시청 제한";
  if (status === "FAILED") return "처리 실패";
  if (status === "PENDING") return "업로드 중";
  if (status === "UPLOADED") return "처리 대기";
  if (status === "PROCESSING") return "인코딩 중";
  return "준비 중";
}
