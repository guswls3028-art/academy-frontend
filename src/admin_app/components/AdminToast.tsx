// PATH: src/admin_app/components/AdminToast.tsx
// 상단 고정 토스트 — 3초 후 페이드, success/error

import { useEffect } from "react";

export type ToastKind = "success" | "error";

type Props = {
  message: string;
  kind?: ToastKind;
  visible: boolean;
  onClose: () => void;
  duration?: number;
};

export default function AdminToast({ message, kind = "success", visible, onClose, duration = 3000 }: Props) {
  useEffect(() => {
    if (!visible || !message) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [visible, message, duration, onClose]);

  if (!visible || !message) return null;

  const isSuccess = kind === "success";
  return (
    <div
      role="alert"
      className="fixed left-4 right-4 top-4 z-[100] flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg animate-in fade-in slide-in-from-top-2 duration-200"
      style={{
        backgroundColor: isSuccess ? "var(--color-emerald-50, #ecfdf5)" : "var(--color-red-50, #fef2f2)",
        color: isSuccess ? "var(--color-emerald-800, #065f46)" : "var(--color-red-800, #991b1b)",
        borderColor: isSuccess ? "var(--color-emerald-200, #a7f3d0)" : "var(--color-red-200, #fecaca)",
      }}
    >
      {isSuccess && <span aria-hidden>✓</span>}
      <span>{message}</span>
    </div>
  );
}
