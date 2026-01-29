import { useMemo } from "react";
import AttendanceBadge from "@/shared/ui/attendance/AttendanceBadge";
import {
  RULE_COLORS,
  RULE_LABELS,
} from "@/features/videos/components/features/video-permission/permission.constants";

interface Props {
  students: any[];
  onOpenPermission: () => void;
  selectedEnrollmentId?: number | null;
  onSelectPreviewStudent?: (enrollmentId: number) => void;
}

export default function StudentWatchPanel({
  students,
  onOpenPermission,
  selectedEnrollmentId,
  onSelectPreviewStudent,
}: Props) {
  const selectable = typeof onSelectPreviewStudent === "function";

  const sorted = useMemo(() => {
    return [...students].sort((a, b) =>
      a.student_name.localeCompare(b.student_name)
    );
  }, [students]);

  return (
    <div className="w-full flex flex-col gap-3">
      {/* ACTION */}
      <div className="flex justify-end">
        <button
          onClick={onOpenPermission}
          className="text-xs rounded bg-[var(--color-primary)] text-white px-3 py-1.5"
        >
          권한 관리
        </button>
      </div>

      {/* LIST */}
      <div className="flex flex-col gap-2">
        {sorted.map((s: any) => {
          const progress = Math.round((s.progress ?? 0) * 100);
          const barWidth = progress === 0 ? 2 : progress;
          const clickable = selectable && s.enrollment;
          const selected = selectedEnrollmentId === s.enrollment;

          return (
            <div
              key={s.enrollment}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : -1}
              onClick={() => {
                if (clickable) onSelectPreviewStudent!(s.enrollment);
              }}
              className={[
                "flex items-center gap-3",
                "rounded-lg border px-3 py-2.5 text-sm",
                "border-[var(--border-divider)] bg-[var(--bg-surface)]",
                "overflow-hidden", // ✅ 핵심
                clickable &&
                  "cursor-pointer hover:bg-[var(--bg-surface-soft)]",
                selected &&
                  "ring-2 ring-[var(--color-primary)] border-[var(--color-primary)]",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {/* NAME */}
              <div className="w-[90px] truncate font-medium text-[var(--text-primary)]">
                {s.student_name}
              </div>

              {/* BADGES */}
              <div className="w-[140px] flex items-center gap-1 shrink-0">
                <AttendanceBadge
                  status={s.attendance_status ?? "UNKNOWN"}
                />

                <span
                  className={[
                    "inline-flex items-center rounded-full px-2 py-0.5",
                    "text-[11px] font-semibold text-white",
                    RULE_COLORS[s.effective_rule] ?? "bg-gray-400",
                  ].join(" ")}
                >
                  {RULE_LABELS[s.effective_rule] ?? "미정"}
                </span>
              </div>

              {/* PROGRESS */}
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <div className="flex-1 h-[8px] rounded bg-[var(--bg-app)] overflow-hidden">
                  <div
                    className="h-full rounded bg-[var(--color-primary)]"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <div className="w-[40px] shrink-0 text-right text-xs text-[var(--text-muted)]">
                  {progress}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
