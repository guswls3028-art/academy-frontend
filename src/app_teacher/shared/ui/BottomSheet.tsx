// PATH: src/app_teacher/shared/ui/BottomSheet.tsx
// 공용 바텀시트 — Phase 2 소통/메시지 등에서 재사용
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import styles from "./BottomSheet.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

const FOCUSABLE = "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
const openSheetStack: HTMLDivElement[] = [];

function isVisibleFocusable(element: HTMLElement) {
  if (element.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none"
    && style.visibility !== "hidden"
    && element.getClientRects().length > 0;
}

function getFocusableElements(sheet: HTMLDivElement) {
  return [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isVisibleFocusable);
}

export default function BottomSheet({ open, onClose, title, children, footer, initialFocusRef }: Props) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    openSheetStack.push(sheet);
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() => {
      const requestedTarget = initialFocusRef?.current;
      const target = requestedTarget && isVisibleFocusable(requestedTarget)
        ? requestedTarget
        : getFocusableElements(sheet)[0] ?? sheet;
      target?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (openSheetStack[openSheetStack.length - 1] !== sheet) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusableElements(sheet);
      if (focusable.length === 0) {
        event.preventDefault();
        sheet.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      const stackIndex = openSheetStack.lastIndexOf(sheet);
      if (stackIndex >= 0) openSheetStack.splice(stackIndex, 1);
      document.body.style.overflow = previousOverflow;
      requestAnimationFrame(() => triggerRef.current?.focus());
    };
  }, [initialFocusRef, open]);

  if (!open) return null;

  return createPortal(
    <>
      <div className={styles.overlay} aria-hidden="true" onClick={onClose} />
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        tabIndex={-1}
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
