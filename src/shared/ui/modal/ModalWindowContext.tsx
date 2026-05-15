/* eslint-disable react-refresh/only-export-components */
// PATH: src/shared/ui/modal/ModalWindowContext.tsx
// 최소화된 모달 상태 관리 Context
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type MinimizedModal = {
  id: string;
  title: string;
  type: string;
  onRestore: () => void;
  onClose: () => void;
};

type ContextValue = {
  modals: MinimizedModal[];
  minimize: (modal: MinimizedModal) => void;
  restore: (id: string) => void;
  remove: (id: string) => void;
};

const ModalWindowCtx = createContext<ContextValue | null>(null);

export function ModalWindowProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [modals, setModals] = useState<MinimizedModal[]>([]);

  const minimize = useCallback((modal: MinimizedModal) => {
    setModals((prev) => {
      if (prev.some((m) => m.id === modal.id)) return prev;
      return [...prev, modal];
    });
  }, []);

  const restore = useCallback((id: string) => {
    let restoreFn: (() => void) | undefined;
    setModals((prev) => {
      const modal = prev.find((m) => m.id === id);
      if (modal) restoreFn = modal.onRestore;
      return prev.filter((m) => m.id !== id);
    });
    // setState 콜백 밖에서 사이드이펙트 호출 (React Strict Mode 안전)
    queueMicrotask(() => restoreFn?.());
  }, []);

  const remove = useCallback((id: string) => {
    setModals((prev) => {
      if (!prev.some((m) => m.id === id)) return prev;
      return prev.filter((m) => m.id !== id);
    });
  }, []);

  const value = useMemo(
    () => ({ modals, minimize, restore, remove }),
    [modals, minimize, restore, remove],
  );

  return (
    <ModalWindowCtx.Provider value={value}>
      {children}
    </ModalWindowCtx.Provider>
  );
}

export function useModalWindow() {
  return useContext(ModalWindowCtx);
}
