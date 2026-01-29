// src/features/videos/components/permission/permission.types.ts

export type TabKey = "permission" | "achievement" | "log";

export interface PermissionModalProps {
  videoId: number;
  open: boolean;
  onClose: () => void;
  focusEnrollmentId?: number | null;
  onChangeFocusEnrollmentId?: (v: number | null) => void;
}
