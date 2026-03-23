// PATH: src/features/videos/components/features/video-detail/components/StudentWatchPanel.tsx

import { useMemo, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { Button } from "@/shared/ui/ds";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import AttendanceStatusBadge from "@/shared/ui/badges/AttendanceStatusBadge";
import type { AttendanceStatus } from "@/shared/ui/badges/AttendanceStatusBadge";
import {
  getAccessLabel,
  getAccessTone,
} from "@/features/videos/components/features/video-permission/permission.constants";

const PAGE_SIZE = 10;

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
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    return [...students].sort((a, b) =>
      String(a.student_name || "").localeCompare(String(b.student_name || ""))
    );
  }, [students]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Reset page when student list changes
  const resetKey = students.length;
  useMemo(() => setPage(0), [resetKey]);

  return (
    <div className="w-full flex flex-col gap-3">
      {/* ACTION */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-text-muted)]">
          {sorted.length}명
        </span>
        <Button type="button" intent="primary" size="sm" onClick={onOpenPermission}>
          권한 관리
        </Button>
      </div>

      {/* LIST */}
      <div className="flex flex-col gap-2">
        {paged.map((s: any) => {
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
                "border-[var(--color-border-divider)] bg-[var(--color-bg-surface)]",
                "overflow-hidden transition-all duration-150",
                clickable && "cursor-pointer hover:bg-[var(--color-bg-surface-hover)] hover:shadow-[var(--elevation-1)]",
                selected && "ring-2 ring-[var(--color-brand-primary)] border-[var(--color-brand-primary)]",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {/* NAME + 아바타 + 강의 딱지 (전역 규칙) */}
              <div className="w-[90px] min-w-0 truncate font-medium text-[var(--color-text-primary)]">
                <StudentNameWithLectureChip
                  name={s.student_name ?? ""}
                  profilePhotoUrl={s.profile_photo_url ?? undefined}
                  avatarSize={24}
                  lectures={
                    s.lecture_title
                      ? [{ lectureName: s.lecture_title, color: s.lecture_color }]
                      : undefined
                  }
                  chipSize={14}
                  clinicHighlight={(s as any).name_highlight_clinic_target === true}
                />
              </div>

              {/* BADGES */}
              <div className="w-[140px] flex items-center gap-1 shrink-0">
                <AttendanceStatusBadge
                  status={(s.attendance_status ?? "INACTIVE") as AttendanceStatus}
                  variant="1ch"
                />
                <span
                  className="ds-status-badge"
                  data-tone={getAccessTone(s.access_mode, s.effective_rule)}
                >
                  {getAccessLabel(s.access_mode, s.effective_rule)}
                </span>
              </div>

              {/* PROGRESS */}
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <div className="flex-1 h-[6px] rounded-full bg-[var(--color-bg-surface-soft)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-300 ease-out"
                    style={{
                      width: `${barWidth}%`,
                      background: progress >= 100
                        ? "var(--color-success)"
                        : "var(--color-brand-primary)",
                    }}
                  />
                </div>
                <div className="w-[40px] shrink-0 text-right text-xs text-[var(--color-text-muted)]">
                  {progress}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-1">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <FiChevronLeft size={14} />
          </button>

          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPage(i)}
              className={[
                "inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-medium transition",
                i === safePage
                  ? "bg-[var(--color-brand-primary)] text-white"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)]",
              ].join(" ")}
            >
              {i + 1}
            </button>
          ))}

          <button
            type="button"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <FiChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
