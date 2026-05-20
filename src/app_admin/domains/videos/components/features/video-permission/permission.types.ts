// src/features/videos/components/permission/permission.types.ts

import type { VideoStatsStudent } from "@admin/domains/videos/api/videos.api";

export type TabKey = "permission" | "achievement" | "log";

export type PermissionStudent = VideoStatsStudent & {
  profile_photo_url?: string | null;
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  name_highlight_clinic_target?: boolean | null;
};

export interface PermissionModalProps {
  videoId: number;
  open: boolean;
  onClose: () => void;
  focusEnrollmentId?: number | null;
  onChangeFocusEnrollmentId?: (v: number | null) => void;
  /** 열릴 때 초기 탭 (권한 설정 / 학습 성적표 / 시청 로그) */
  initialTab?: TabKey;
}
