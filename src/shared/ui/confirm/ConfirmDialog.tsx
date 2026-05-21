// PATH: src/shared/ui/confirm/ConfirmDialog.tsx
import { useCallback, useEffect, useRef, useState } from "react";
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
  const confirmedRef = useRef(false);
  const [remember, setRemember] = useState(false);

  const safeConfirm = useCallback(() => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    if (rememberKey && remember) {
      try { localStorage.setItem(rememberKey, "1"); } catch { /* private mode */ }
    }
    onConfirm();
  }, [onConfirm, remember, rememberKey]);

  const { offset, onMouseDown, onTouchStart } = useDraggableModal(
    ".confirm-drag-handle",
    { enableMinimize: false },
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onCancel();
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
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [onCancel, safeConfirm]);

  // Focus confirm button on mount for accessibility
  useEffect(() => {
    confirmBtnRef.current?.focus();
  }, []);

  const hasOffset = offset.x !== 0 || offset.y !== 0;

  return createPortal(
    <div data-confirm-dialog className="confirm-dialog__backdrop" onClick={onCancel}>
      <div
        className="confirm-dialog__positioner"
        style={hasOffset ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        <div className="confirm-dialog__card" onClick={(e) => e.stopPropagation()}>
          <h3 className="confirm-dialog__title confirm-drag-handle">{title}</h3>
          <p className="confirm-dialog__message">{message}</p>
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
            <button type="button" className="confirm-dialog__button confirm-dialog__button--cancel" onClick={onCancel}>
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
