import { useRef } from "react";
import { useConfirm } from "@/shared/ui/confirm";

/** One close path for the button, backdrop and Escape of an edited form. */
export function useConfirmBeforeClose(dirty: boolean, blocked: boolean, onClose: () => void) {
  const confirm = useConfirm();
  const confirming = useRef(false);
  const current = useRef({ dirty, blocked, onClose });
  current.current = { dirty, blocked, onClose };
  return async () => {
    if (current.current.blocked || confirming.current) return;
    if (!current.current.dirty) { current.current.onClose(); return; }
    confirming.current = true;
    try {
      const discard = await confirm({
        title: "작성 중인 내용이 있습니다",
        message: "저장하지 않은 내용을 버리고 닫을까요?",
        confirmText: "내용 버리고 닫기",
        cancelText: "계속 작성",
        danger: true,
      });
      if (discard && !current.current.blocked) current.current.onClose();
    } finally { confirming.current = false; }
  };
}
