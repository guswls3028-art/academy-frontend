// PATH: src/app_teacher/shared/ui/BottomSheet.tsx
// 공용 바텀시트 — Phase 2 소통/메시지 등에서 재사용
import { useEffect, type ReactNode } from "react";
import styles from "./BottomSheet.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export default function BottomSheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} className={styles.overlay} />
      <div className={styles.sheet}>
        {/* Handle */}
        <div className={styles.handleWrap}>
          <div className={styles.handle} />
        </div>

        {/* Title */}
        {title && (
          <div className={styles.header}>
            <div className={styles.title}>{title}</div>
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="닫기"
              title="닫기"
            >
              ×
            </button>
          </div>
        )}

        {/* Content */}
        <div className={styles.content}>{children}</div>
      </div>
    </>
  );
}
