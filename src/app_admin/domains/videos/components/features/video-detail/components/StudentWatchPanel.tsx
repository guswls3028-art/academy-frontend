// PATH: src/app_admin/domains/videos/components/features/video-detail/components/StudentWatchPanel.tsx

import { useEffect, useMemo, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiSmartphone } from "react-icons/fi";
import { Badge, Button, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import AttendanceStatusBadge from "@/shared/ui/badges/AttendanceStatusBadge";
import type { AttendanceStatus } from "@/shared/ui/badges/AttendanceStatusBadge";
import type { VideoStatsStudent } from "@admin/domains/videos/api/videos.api";
import {
  isVideoProgressComplete,
  videoProgressPercent,
} from "@/shared/api/contracts/videos";
import {
  getAccessLabel,
  getAccessTone,
} from "@admin/domains/videos/components/features/video-permission/permission.constants";

const PAGE_SIZE = 10;

export type StudentWatchRow = VideoStatsStudent & {
  profile_photo_url?: string | null;
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  name_highlight_clinic_target?: boolean | null;
};

interface Props {
  students: StudentWatchRow[];
  onOpenPermission: () => void;
  openingStudentId?: number | null;
  onOpenStudentView: (studentId: number) => void;
}

function studentMeta(school?: string | null, grade?: string | null): string {
  const normalizedGrade = String(grade || "").trim();
  const gradeLabel = normalizedGrade
    ? /학년$/.test(normalizedGrade)
      ? normalizedGrade
      : `${normalizedGrade}학년`
    : "";
  return [String(school || "").trim(), gradeLabel].filter(Boolean).join(" · ");
}

export default function StudentWatchPanel({
  students,
  onOpenPermission,
  openingStudentId,
  onOpenStudentView,
}: Props) {
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
  useEffect(() => {
    setPage(0);
  }, [students.length]);

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-[var(--color-text-muted)]">
          학생 {sorted.length}명
        </span>
        <Button type="button" intent="primary" size="sm" onClick={onOpenPermission}>
          권한 관리
        </Button>
      </div>

      {paged.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-8 text-center">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">수강 학생이 없습니다</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">강의 수강생이 등록되면 시청 현황이 여기에 표시됩니다.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="학생별 시청 현황">
          {paged.map((s) => {
            const progress = videoProgressPercent(s.progress);
            const completed = isVideoProgressComplete(s.progress, s.completed);
            const barWidth = progress === 0 ? 2 : Math.min(100, Math.max(0, progress));
            const name = String(s.student_name || "이름 없음");
            const meta = studentMeta(s.school, s.grade);
            const studentId = Number(s.student_id);
            const canOpenStudentView = Number.isInteger(studentId) && studentId > 0;
            const opening = canOpenStudentView && openingStudentId === studentId;

            return (
              <li
                key={s.enrollment}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2.5 overflow-hidden rounded-xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] px-3 py-3 text-sm transition-[border-color,box-shadow] duration-150 focus-within:border-[var(--color-brand-primary)] focus-within:shadow-[var(--elevation-1)]"
              >
                <div className="min-w-0 font-medium text-[var(--color-text-primary)]">
                  <StudentNameWithLectureChip
                    name={name}
                    profilePhotoUrl={s.profile_photo_url ?? undefined}
                    avatarSize={24}
                    lectures={
                      s.lecture_title
                        ? [{ lectureName: s.lecture_title, color: s.lecture_color, chipLabel: s.lecture_chip_label }]
                        : undefined
                    }
                    chipSize={14}
                    clinicHighlight={s.name_highlight_clinic_target === true}
                  />
                  {meta && (
                    <p className="mt-1 truncate pl-8 text-xs font-normal text-[var(--color-text-muted)]">
                      {meta}
                    </p>
                  )}
                </div>

                <Button
                  type="button"
                  intent="secondary"
                  size="sm"
                  disabled={!canOpenStudentView || opening}
                  title={canOpenStudentView ? undefined : "학생 정보를 확인할 수 없어 화면을 열 수 없습니다."}
                  aria-label={`${name} 학생 화면 보기`}
                  aria-busy={opening}
                  onClick={() => {
                    if (canOpenStudentView && !opening) onOpenStudentView(studentId);
                  }}
                  leftIcon={<FiSmartphone size={ICON_FOR_BUTTON.sm} aria-hidden />}
                >
                  {opening ? "여는 중…" : "화면 보기"}
                </Button>

                <div className="col-span-2 flex min-w-0 items-center gap-2.5">
                  <div
                    className="flex shrink-0 items-center gap-1.5"
                    aria-label={`${name} 상태`}
                  >
                    <AttendanceStatusBadge
                      status={(s.attendance_status ?? "INACTIVE") as AttendanceStatus}
                      variant="2ch"
                    />
                    <Badge
                      variant="solid"
                      tone={getAccessTone(s.access_mode, s.effective_rule)}
                      title="영상 시청 권한"
                    >
                      {getAccessLabel(s.access_mode, s.effective_rule)}
                    </Badge>
                  </div>

                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div
                      className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-surface-soft)]"
                      role="progressbar"
                      aria-label={`${name} 진도 ${progress}%`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress}
                    >
                      <div
                        className="h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
                        // eslint-disable-next-line no-restricted-syntax -- progress width/color is data-driven per student row.
                        style={{
                          width: `${barWidth}%`,
                          background: completed
                            ? "var(--color-success)"
                            : "var(--color-brand-primary)",
                        }}
                      />
                    </div>
                    <div className="w-[36px] shrink-0 text-right text-xs tabular-nums text-[var(--color-text-muted)]">
                      {progress}%
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-1">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="이전 학생 목록 페이지"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <FiChevronLeft size={14} />
          </button>

          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPage(i)}
              aria-label={`학생 목록 ${i + 1}페이지`}
              aria-current={i === safePage ? "page" : undefined}
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
            aria-label="다음 학생 목록 페이지"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <FiChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
