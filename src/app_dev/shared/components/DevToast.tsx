import { useEffect, createContext, useContext, useState, useCallback, type ReactNode } from "react";
import s from "@dev/layout/DevLayout.module.css";

type ToastKind = "success" | "error";
type ToastItem = { id: number; message: string; kind: ToastKind };

type ToastContextType = {
  toast: (message: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

let nextId = 0;

export function DevToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = ++nextId;
    setItems((prev) => [...prev, { id, message, kind }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {items.map((item) => (
        <ToastNotification key={item.id} item={item} onDismiss={dismiss} />
      ))}
    </ToastContext.Provider>
  );
}

export function useDevToast() {
  return useContext(ToastContext);
}

function ToastNotification({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(item.id), 3500);
    return () => clearTimeout(t);
  }, [item.id, onDismiss]);

  return (
    <div
      role="alert"
      className={`${s.toast} ${item.kind === "success" ? s.toastSuccess : s.toastError}`}
    >
      <span>{item.kind === "success" ? "✓" : "✕"}</span>
      <span>{item.message}</span>
      <button type="button" className={s.toastClose} onClick={() => onDismiss(item.id)}>
        ×
      </button>
    </div>
  );
}
