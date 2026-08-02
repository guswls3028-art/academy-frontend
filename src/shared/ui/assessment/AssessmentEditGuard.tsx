/* eslint-disable react-refresh/only-export-components -- assessment provider and its registration hooks share one context boundary. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useConfirm } from "@/shared/ui/confirm";

type AssessmentEditGuardValue = {
  hasUnsavedChanges: boolean;
  registerDirty: (key: string, dirty: boolean) => void;
  confirmDiscard: () => Promise<boolean>;
};

const AssessmentEditGuardContext = createContext<AssessmentEditGuardValue>({
  hasUnsavedChanges: false,
  registerDirty: () => undefined,
  confirmDiscard: async () => true,
});

export function AssessmentEditGuardProvider({ children }: { children: ReactNode }) {
  const confirm = useConfirm();
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(() => new Set());
  const hasUnsavedChanges = dirtyKeys.size > 0;

  const registerDirty = useCallback((key: string, dirty: boolean) => {
    setDirtyKeys((current) => {
      const hasKey = current.has(key);
      if (hasKey === dirty) return current;
      const next = new Set(current);
      if (dirty) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const confirmDiscard = useCallback(async () => {
    if (!hasUnsavedChanges) return true;
    return confirm({
      title: "저장하지 않은 설정이 있습니다",
      message: "이동하면 현재 입력한 시험·과제 운영 설정이 사라집니다.",
      confirmText: "저장하지 않고 이동",
      cancelText: "계속 편집",
      danger: true,
    });
  }, [confirm, hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  const value = useMemo(
    () => ({ hasUnsavedChanges, registerDirty, confirmDiscard }),
    [confirmDiscard, hasUnsavedChanges, registerDirty],
  );

  return (
    <AssessmentEditGuardContext.Provider value={value}>
      {children}
    </AssessmentEditGuardContext.Provider>
  );
}

export function useAssessmentEditGuard() {
  return useContext(AssessmentEditGuardContext);
}

export function useAssessmentDirtyRegistration(key: string, dirty: boolean) {
  const { registerDirty } = useAssessmentEditGuard();

  useEffect(() => {
    registerDirty(key, dirty);
    return () => registerDirty(key, false);
  }, [dirty, key, registerDirty]);
}
