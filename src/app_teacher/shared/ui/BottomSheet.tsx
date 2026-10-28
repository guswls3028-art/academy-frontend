// PATH: src/app_teacher/shared/ui/BottomSheet.tsx
// 공용 바텀시트 — Phase 2 소통/메시지 등에서 재사용
import { useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import styles from "./BottomSheet.module.css";
import { useDialogSurface } from "@/shared/ui/overlays/useDialogSurface";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  closeDisabled?: boolean;
}

export default function BottomSheet({ open, onClose, title, children, footer, initialFocusRef, closeDisabled = false }: Props) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const requestClose = () => { if (!closeDisabled) onClose(); };
  useDialogSurface(open, sheetRef, requestClose, initialFocusRef);

  if (!open) return null;

  return createPortal(
    <>
      <div className={styles.overlay} aria-hidden="true" onClick={requestClose} />
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-busy={closeDisabled || undefined}
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
              onClick={requestClose}
              disabled={closeDisabled}
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
