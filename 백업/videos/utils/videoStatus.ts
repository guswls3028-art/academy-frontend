import { VideoStatus } from "@/features/lectures/api/videos";

export const VIDEO_STATUS_LABEL: Record<VideoStatus, string> = {
  PENDING: "업로드 대기",
  UPLOADED: "업로드 완료",
  PROCESSING: "인코딩 중",
  READY: "시청 가능",
  FAILED: "처리 실패",
};

export const VIDEO_STATUS_STYLE: Record<VideoStatus, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  UPLOADED: "bg-blue-100 text-blue-700",
  PROCESSING: "bg-yellow-100 text-yellow-700",
  READY: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};
