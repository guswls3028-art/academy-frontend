// PATH: src/app_teacher/domains/attendance/components/AttendanceCard.tsx
// 출석 카드 — 스와이프로 상태 변경, 탭으로 전체 상태 선택
import { useSwipeGesture } from "../hooks/useSwipeGesture";
import { STATUS_CONFIG } from "../api";

interface Props {
  record: any; // attendance row from fetchAttendance
  onStatusChange: (id: number, status: string) => void;
  onTap: (record: any) => void;
}

export default function AttendanceCard({
  record,
  onStatusChange,
  onTap,
}: Props) {
  const cfg = STATUS_CONFIG[record.status] ?? STATUS_CONFIG.PRESENT;
  const studentName = record.name ?? record.student_name ?? "이름 없음";

  const { state, handlers } = useSwipeGesture({
    threshold: 80,
    onSwipeRight: () => onStatusChange(record.id, "PRESENT"),
    onSwipeLeft: () => onStatusChange(record.id, "ABSENT"),
  });

  const swipeBg = state.isSwiping
    ? state.direction === "right"
      ? `rgba(34,197,94,${Math.min(Math.abs(state.offsetX) / 200, 0.25)})`
      : `rgba(239,68,68,${Math.min(Math.abs(state.offsetX) / 200, 0.25)})`
    : "transparent";

  const hint =
    state.isSwiping && Math.abs(state.offsetX) > 30
      ? state.direction === "right"
        ? "출석"
        : "결석"
      : null;

  return (
    <div className="relative overflow-hidden rounded-lg" style={{ background: swipeBg }}>
      {/* Swipe hint */}
      {hint && (
        <div
          className="absolute top-1/2 -translate-y-1/2 text-[13px] font-bold pointer-events-none"
          style={{
            [state.direction === "right" ? "left" : "right"]: 16,
            color:
              state.direction === "right"
                ? "var(--tc-success)"
                : "var(--tc-danger)",
          }}
        >
          {hint}
        </div>
      )}

      {/* Card */}
      <div
        {...handlers}
        onClick={() => onTap(record)}
        className="flex items-center justify-between rounded-lg cursor-pointer select-none"
        style={{
          padding: "var(--tc-space-3) var(--tc-space-4)",
          background: "var(--tc-surface)",
          border: "1px solid var(--tc-border)",
          transform: state.isSwiping
            ? `translateX(${state.offsetX}px)`
            : "translateX(0)",
          transition: state.isSwiping ? "none" : "transform 200ms ease",
          touchAction: "pan-y",
        }}
      >
        {/* Left: student info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-base shrink-0"
            style={{ background: "var(--tc-surface-soft)" }}
          >
            {studentName[0]}
          </div>
          <div className="min-w-0">
            <div
              className="text-[15px] font-semibold"
              style={{ color: "var(--tc-text)" }}
            >
              {studentName}
            </div>
          </div>
        </div>

        {/* Right: status badge */}
        <div
          className="text-xs font-bold rounded-full shrink-0"
          style={{
            padding: "4px 12px",
            background: cfg.bg,
            color: cfg.color,
          }}
        >
          {cfg.label}
        </div>
      </div>
    </div>
  );
}
