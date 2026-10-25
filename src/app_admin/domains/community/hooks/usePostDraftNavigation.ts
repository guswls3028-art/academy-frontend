import { useCallback, useEffect, useMemo, useRef } from "react";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";

export type PostDraftStateChange = (dirty: boolean, busy: boolean) => void;

/** Keep independent content/file drafts until a user explicitly leaves them. */
export function usePostDraftNavigation() {
  const confirm = useConfirm();
  const states = useRef<Record<string, { dirty: boolean; busy: boolean }>>({});
  const confirming = useRef(false);
  const hasPending = useCallback(() => Object.values(states.current).some((state) => state.dirty || state.busy), []);
  const callbacks = useMemo(() => {
    const forPart = (part: string): PostDraftStateChange => (dirty, busy) => { states.current[part] = { dirty, busy }; };
    return { onCreateStateChange: forPart("create"), onContentStateChange: forPart("content"), onAttachmentStateChange: forPart("attachments") };
  }, []);
  const run = useCallback(async (navigate: () => void) => {
    if (confirming.current) return;
    if (Object.values(states.current).some((state) => state.busy)) {
      feedback.info("저장이 끝난 뒤 이동해 주세요.");
      return;
    }
    if (Object.values(states.current).some((state) => state.dirty)) {
      confirming.current = true;
      try {
        if (!await confirm({ title: "저장하지 않은 변경이 있습니다", message: "이동하면 미저장 본문과 파일 선택이 사라집니다. 이미 저장된 내용과 첨부는 유지됩니다.", confirmText: "저장하지 않고 이동", cancelText: "계속 편집" })) return;
      } finally { confirming.current = false; }
    }
    navigate();
  }, [confirm]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!Object.values(states.current).some((state) => state.dirty || state.busy)) return;
      event.preventDefault(); event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  return { ...callbacks, run, hasPending };
}
