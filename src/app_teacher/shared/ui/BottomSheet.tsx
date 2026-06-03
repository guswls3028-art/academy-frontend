// PATH: src/app_teacher/shared/ui/BottomSheet.tsx
// 공용 바텀시트 — Phase 2 소통/메시지 등에서 재사용
import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./BottomSheet.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function BottomSheet({ open, onClose, title, children, footer }: Props) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <>
      <div onClick={onClose} className={styles.overlay} />
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        {/* Handle */}
        <div className={styles.handleWrap}>
          <div className={styles.handle} />
        </div>

        {/* Title */}
        {title && (
          <div className={styles.header}>
            <div id={titleId} className={styles.title}>{title}</div>
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
        <div className={`${styles.content} ${footer ? styles.contentWithFooter : ""}`}>{children}</div>
        {footer && (
          <div className={styles.footer}>
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
