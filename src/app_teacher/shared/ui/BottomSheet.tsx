// PATH: src/app_teacher/shared/ui/BottomSheet.tsx
// 공용 바텀시트 — Phase 2 소통/메시지 등에서 재사용
import { useEffect, type ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export default function BottomSheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0"
        style={{
          zIndex: "var(--tc-z-bottom-sheet)" as any,
          background: "rgba(0,0,0,0.35)",
        }}
      />
      <div
        className="fixed left-0 right-0 bottom-0"
        style={{
          zIndex: "calc(var(--tc-z-bottom-sheet) + 1)" as any,
          background: "var(--tc-surface)",
          borderRadius: "var(--tc-radius-xl) var(--tc-radius-xl) 0 0",
          paddingBottom: "calc(var(--tc-safe-bottom) + var(--tc-space-4))",
          animation: "tcSlideUp 200ms ease",
          maxHeight: "85dvh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center shrink-0" style={{ padding: "var(--tc-space-3) 0" }}>
          <div
            className="rounded-full"
            style={{ width: 36, height: 4, background: "var(--tc-border-strong)" }}
          />
        </div>

        {/* Title */}
        {title && (
          <div
            className="text-[15px] font-bold shrink-0"
            style={{
              padding: "0 var(--tc-space-4) var(--tc-space-3)",
              color: "var(--tc-text)",
            }}
          >
            {title}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "0 var(--tc-space-4)" }}>
          {children}
        </div>

        <style>{`@keyframes tcSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      </div>
    </>
  );
}
