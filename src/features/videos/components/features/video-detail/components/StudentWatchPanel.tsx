// PATH: src/features/videos/components/features/video-detail/components/StudentWatchPanel.tsx

import { useMemo } from "react";
import { Button } from "@/shared/ui/ds";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import AttendanceStatusBadge from "@/shared/ui/badges/AttendanceStatusBadge";
import type { AttendanceStatus } from "@/shared/ui/badges/AttendanceStatusBadge";
import {
  RULE_COLORS,
  RULE_LABELS,
  getAccessLabel,
  getAccessTone,
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
      String(a.student_name || "").localeCompare(String(b.student_name || ""))
    );
  }, [students]);

  return (
    <div className="w-full flex flex-col gap-3">
      {/* ACTION */}
      <div className="flex justify-end">
        <Button type="button" intent="primary" size="sm" onClick={onOpenPermission}>
          권한 관리
        </Button>
      </div>

      {/* LIST */}
      <div className="flex flex-col gap-2">
        {sorted.map((s: any) => {
          const progress = Math.round((Number(s.progress ?? 0) || 0) * 100);
          const barWidth = progress === 0 ? 2 : Math.min(100, Math.max(0, progress));
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
              onKeyDown={(e) => {
                if (!clickable) return;
                if (e.key === "Enter" || e.key === " ") onSelectPreviewStudent!(s.enrollment);
              }}
              className={[
                "flex items-center gap-3",
                "rounded-lg border px-3 py-2.5 text-sm",
                "border-[var(--border-divider)] bg-[var(--bg-surface)]",
                "overflow-hidden",
                clickable && "cursor-pointer hover:bg-[var(--bg-surface-soft)]",
                selected && "ring-2 ring-[var(--color-primary)] border-[var(--color-primary)]",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {/* NAME + 강의 딱지 (전역 규칙) */}
              <div className="w-[90px] min-w-0 truncate font-medium text-[var(--text-primary)]">
                <StudentNameWithLectureChip
                  name={s.student_name ?? ""}
                  lectures={
                    s.lecture_title
                      ? [{ lectureName: s.lecture_title, color: s.lecture_color }]
                      : undefined
                  }
                  chipSize={14}
                />
              </div>

              {/* BADGES */}
              <div className="w-[140px] flex items-center gap-1 shrink-0">
                <AttendanceStatusBadge
                  status={(s.attendance_status ?? "INACTIVE") as AttendanceStatus}
                  variant="1ch"
                />
                <span
                  className={[
                    "ds-status-badge",
                    getAccessColor(s.access_mode, s.effective_rule)
                      .split(/\s+/)
                      .map((c) => (c.startsWith("bg-") || c.startsWith("text-") ? `!${c}` : c))
                      .join(" "),
                  ].join(" ")}
                >
                  {getAccessLabel(s.access_mode, s.effective_rule)}
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
