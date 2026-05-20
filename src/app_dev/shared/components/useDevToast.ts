import { createContext, useContext } from "react";

export type ToastKind = "success" | "error";
export type ToastItem = { id: number; message: string; kind: ToastKind };

type ToastContextType = {
  toast: (message: string, kind?: ToastKind) => void;
};

export const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export function useDevToast() {
  return useContext(ToastContext);
}
