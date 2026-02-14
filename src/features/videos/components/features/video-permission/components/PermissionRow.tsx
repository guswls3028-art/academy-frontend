// PATH: src/features/videos/components/features/video-permission/components/PermissionRow.tsx

import AttendanceStatusBadge from "@/shared/ui/badges/AttendanceStatusBadge";
import type { AttendanceStatus } from "@/shared/ui/badges/AttendanceStatusBadge";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { RULE_COLORS, RULE_LABELS, getAccessLabel, getAccessTone } from "../permission.constants";

function Pill({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={[
        "inline-flex items-center justify-center",
        "h-[22px] px-2 rounded-full",
        "text-[11px] font-semibold leading-none",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export default function PermissionRow({
  student,
  selected,
  onToggle,
}: {
  student: any;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={[
        "permission-row",
        selected ? "permission-row-selected" : "",
        // ✅ row hover/active 강화 (SaaS 느낌)
        "transition",
        selected
          ? "ring-1 ring-[color-mix(in_srgb,var(--color-primary)_45%,transparent)]"
          : "",
      ].join(" ")}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onToggle();
      }}
    >
      {/* CHECK */}
      <div className="permission-checkbox" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={onToggle} />
      </div>

      {/* NAME + 아바타 + 강의 딱지 (전역 규칙) */}
      <div className="permission-name text-[var(--text-primary)]">
        <StudentNameWithLectureChip
          name={student.student_name ?? ""}
          profilePhotoUrl={student.profile_photo_url ?? undefined}
          avatarSize={24}
          lectures={
            student.lecture_title
              ? [{ lectureName: student.lecture_title, color: student.lecture_color }]
              : undefined
          }
          chipSize={14}
        />
      </div>

      {/* ✅ ATTENDANCE (SSOT: AttendanceStatusBadge 1ch) */}
      <div className="w-[90px] flex justify-center">
        <AttendanceStatusBadge
          status={(student.attendance_status ?? "INACTIVE") as AttendanceStatus}
          variant="1ch"
        />
      </div>

      {/* ACCESS MODE — SSOT: ds-status-badge + data-tone */}
      <div className="w-[90px] flex justify-center">
        <span
          className="ds-status-badge"
          data-tone={getAccessTone(student.access_mode, student.effective_rule)}
        >
          {getAccessLabel(student.access_mode, student.effective_rule)}
        </span>
      </div>

      {/* COMPLETED */}
      <div className="w-[80px] flex justify-center">
        <span className="text-xs text-[var(--text-secondary)]">
          {student.completed ? "완료" : "미완료"}
        </span>
      </div>

      {/* PHONES / META */}
      <div className="w-[150px] permission-text-xs">
        {student.parent_phone || "-"}
      </div>
      <div className="w-[150px] permission-text-xs">
        {student.student_phone || "-"}
      </div>
      <div className="w-[140px] permission-text-xs">
        {student.school || "-"}
      </div>
      <div className="w-[60px] text-center text-xs text-[var(--text-secondary)]">
        {student.grade || "-"}
      </div>
    </div>
  );
}
