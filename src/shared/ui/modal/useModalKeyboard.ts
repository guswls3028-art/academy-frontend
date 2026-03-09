// PATH: src/shared/ui/modal/useModalKeyboard.ts
// Esc: 닫기, Enter: 긍정(등록/적용/확인) — textarea에서는 Enter로 제출하지 않음

import { useEffect } from "react";

export function useModalKeyboard(
  open: boolean,
  onClose: () => void,
  onConfirm?: () => void
) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Enter" && onConfirm) {
        const el = document.activeElement as HTMLElement | null;
        const isTextarea = el?.tagName === "TEXTAREA";
        const isContentEditable = el?.getAttribute?.("contenteditable") === "true";
        if (!isTextarea && !isContentEditable) {
          e.preventDefault();
          onConfirm();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, onConfirm]);
}
