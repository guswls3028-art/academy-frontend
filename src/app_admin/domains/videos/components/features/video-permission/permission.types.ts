// src/features/videos/components/permission/permission.types.ts

export type TabKey = "permission" | "achievement" | "log";

export interface PermissionModalProps {
  videoId: number;
  open: boolean;
  onClose: () => void;
  focusEnrollmentId?: number | null;
  onChangeFocusEnrollmentId?: (v: number | null) => void;
  /** 열릴 때 초기 탭 (권한 설정 / 학습 성적표 / 시청 로그) */
  initialTab?: TabKey;
}
