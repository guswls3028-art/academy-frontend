// PATH: src/shared/ui/confirm/ConfirmProvider.tsx
import { createContext, useCallback, useRef, useState } from "react";
import ConfirmDialog, { type ConfirmOptions } from "./ConfirmDialog";

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    // rememberKey opt-in — 사용자가 이전에 "다음부터 묻지 않기" 체크 후 확인했다면
    // localStorage[rememberKey] === "1" → dialog 없이 즉시 true resolve (routine 액션 UX).
    if (opts.rememberKey) {
      try {
        if (localStorage.getItem(opts.rememberKey) === "1") {
          return Promise.resolve(true);
        }
      } catch { /* private mode — fall through to normal dialog */ }
    }
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions(opts);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolverRef.current?.(true);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const handleCancel = useCallback(() => {
    resolverRef.current?.(false);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <ConfirmDialog
          {...options}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
}
