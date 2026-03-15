// PATH: src/shared/ui/confirm/ConfirmDialog.tsx
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./confirm-dialog.css";

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
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
  onConfirm,
  onCancel,
}: Props) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onConfirm, onCancel]);

  // Focus confirm button on mount for accessibility
  useEffect(() => {
    confirmBtnRef.current?.focus();
  }, []);

  return createPortal(
    <div style={backdropStyle} onClick={onCancel}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={titleStyle}>{title}</h3>
        <p style={messageStyle}>{message}</p>
        <div style={actionsStyle}>
          <button type="button" style={cancelBtnStyle} onClick={onCancel}>
            {cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            style={danger ? dangerBtnStyle : confirmBtnStyle}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── inline styles using design tokens ── */

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0, 0, 0, 0.45)",
  animation: "confirm-fade-in 120ms ease-out",
};

const cardStyle: React.CSSProperties = {
  background: "var(--color-bg-surface, #fff)",
  borderRadius: "var(--radius-lg, 14px)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
  padding: "var(--space-6, 24px)",
  maxWidth: 400,
  width: "calc(100% - 32px)",
  animation: "confirm-scale-in 150ms ease-out",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 17,
  fontWeight: 700,
  color: "var(--color-text-primary, #111)",
  lineHeight: 1.4,
};

const messageStyle: React.CSSProperties = {
  margin: "var(--space-3, 12px) 0 var(--space-5, 20px)",
  fontSize: 14,
  color: "var(--color-text-secondary, #555)",
  lineHeight: 1.6,
  whiteSpace: "pre-line",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "var(--space-2, 8px)",
};

const btnBase: React.CSSProperties = {
  padding: "8px 18px",
  fontSize: 14,
  fontWeight: 600,
  borderRadius: "var(--radius-md, 8px)",
  border: "none",
  cursor: "pointer",
  transition: "opacity 120ms",
  lineHeight: 1.4,
};

const cancelBtnStyle: React.CSSProperties = {
  ...btnBase,
  background: "var(--color-bg-surface-soft, #f3f4f6)",
  color: "var(--color-text-secondary, #555)",
};

const confirmBtnStyle: React.CSSProperties = {
  ...btnBase,
  background: "var(--color-brand-primary, #6366f1)",
  color: "#fff",
};

const dangerBtnStyle: React.CSSProperties = {
  ...btnBase,
  background: "var(--color-danger, #ef4444)",
  color: "#fff",
};
