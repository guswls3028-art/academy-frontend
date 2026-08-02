// PATH: src/shared/ui/confirm/ConfirmDialog.tsx
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDraggableModal } from "@/shared/ui/modal/useDraggableModal";
import "./confirm-dialog.css";

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  /**
   * 사용자가 "다음부터 묻지 않기" 체크 후 확인 → localStorage[rememberKey] = "1".
   * Provider가 다음 호출부터 dialog 띄우지 않고 즉시 true resolve.
   * 반복 액션(예: 매번 묻는 submit) 의 routine UX 최적화 용.
   */
  rememberKey?: string;
  /** 체크박스 라벨 (기본 "다음부터 묻지 않기"). rememberKey 와 함께 사용. */
  rememberLabel?: string;
};

type Props = ConfirmOptions & {
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  title,
  message,
  confirmText = "확인",
  cancelText = "취소",
  danger = false,
  rememberKey,
  rememberLabel = "다음부터 묻지 않기",
  onConfirm,
  onCancel,
}: Props) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const settledRef = useRef(false);
  const [remember, setRemember] = useState(false);
  const titleId = useId();
  const messageId = useId();

  const safeConfirm = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    if (rememberKey && remember) {
      try { localStorage.setItem(rememberKey, "1"); } catch { /* private mode */ }
    }
    onConfirm();
  }, [onConfirm, remember, rememberKey]);

  const safeCancel = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    onCancel();
  }, [onCancel]);

  const { offset, onMouseDown, onTouchStart } = useDraggableModal(
    ".confirm-drag-handle",
    { enableMinimize: false },
  );

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        safeCancel();
      } else if (e.key === "Enter") {
        // input/textarea/select/contenteditable에서는 Enter 무시
        const tag = (e.target as HTMLElement)?.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          (e.target as HTMLElement)?.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        safeConfirm();
      } else if (e.key === "Tab") {
        const focusable = Array.from(
          cardRef.current?.querySelectorAll<HTMLElement>(
            "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
          ) ?? [],
        ).filter((element) => element.getClientRects().length > 0);
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler, true);
    confirmBtnRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handler, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [safeCancel, safeConfirm]);

  const hasOffset = offset.x !== 0 || offset.y !== 0;

  return createPortal(
    <div data-confirm-dialog className="confirm-dialog__backdrop" onClick={safeCancel}>
      <div
        className="confirm-dialog__positioner"
        style={hasOffset ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        <div
          ref={cardRef}
          className="confirm-dialog__card"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={messageId}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 id={titleId} className="confirm-dialog__title confirm-drag-handle">{title}</h3>
          <p id={messageId} className="confirm-dialog__message">{message}</p>
          {rememberKey && (
            <label className="confirm-dialog__remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="confirm-dialog__remember-checkbox"
              />
              <span>{rememberLabel}</span>
            </label>
          )}
          <div className="confirm-dialog__actions">
            <button type="button" className="confirm-dialog__button confirm-dialog__button--cancel" onClick={safeCancel}>
              {cancelText}
            </button>
            <button
              ref={confirmBtnRef}
              type="button"
              className={`confirm-dialog__button ${danger ? "confirm-dialog__button--danger" : "confirm-dialog__button--confirm"}`}
              onClick={safeConfirm}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
