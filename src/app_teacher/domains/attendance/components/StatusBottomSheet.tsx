// PATH: src/app_teacher/domains/attendance/components/StatusBottomSheet.tsx
// 출석 상태 선택 바텀시트 — 6개 주요 상태
import { useEffect } from "react";
import { STATUS_CONFIG, QUICK_STATUSES } from "../api";

interface Props {
  open: boolean;
  record: any | null;
  onSelect: (id: number, status: string) => void;
  onClose: () => void;
}

export default function StatusBottomSheet({
  open,
  record,
  onSelect,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || !record) return null;
  const studentName = record.name ?? record.student_name ?? "학생";

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
        }}
      >
        {/* Handle */}
        <div className="flex justify-center" style={{ padding: "var(--tc-space-3) 0" }}>
          <div
            className="rounded-full"
            style={{
              width: 36,
              height: 4,
              background: "var(--tc-border-strong)",
            }}
          />
        </div>

        {/* Title */}
        <div
          className="text-[15px] font-bold"
          style={{
            padding: "0 var(--tc-space-4) var(--tc-space-3)",
            color: "var(--tc-text)",
          }}
        >
          {studentName} 출석 상태
        </div>

        {/* Status grid */}
        <div
          className="grid grid-cols-3 gap-2"
          style={{ padding: "0 var(--tc-space-4)" }}
        >
          {QUICK_STATUSES.map((status) => {
            const cfg = STATUS_CONFIG[status];
            const active = record.status === status;
            return (
              <button
                key={status}
                onClick={() => {
                  onSelect(record.id, status);
                  onClose();
                }}
                className="flex flex-col items-center gap-1 cursor-pointer"
                style={{
                  padding: "var(--tc-space-3)",
                  borderRadius: "var(--tc-radius)",
                  border: active
                    ? `2px solid ${cfg.color}`
                    : "1px solid var(--tc-border)",
                  background: active ? cfg.bg : "transparent",
                }}
              >
                <span
                  className="text-sm font-bold"
                  style={{ color: cfg.color }}
                >
                  {cfg.label}
                </span>
              </button>
            );
          })}
        </div>

        <style>{`@keyframes tcSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      </div>
    </>
  );
}
