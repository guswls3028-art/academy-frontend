// PATH: src/app_admin/domains/videos/components/features/video-permission/components/PermissionRow.tsx

import AttendanceStatusBadge from "@/shared/ui/badges/AttendanceStatusBadge";
import type { AttendanceStatus } from "@/shared/ui/badges/AttendanceStatusBadge";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { Badge } from "@/shared/ui/ds";
import { getAccessLabel, getAccessTone } from "../permission.constants";

export default function PermissionRow({
  student,
  selected,
  onToggle,
  isAlt,
}: {
  student: any;
  selected: boolean;
  onToggle: () => void;
  isAlt?: boolean;
}) {
  return (
    <div
      className={[
        "permission-row",
        selected && "permission-row-selected",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onToggle();
      }}
      style={{
        background: selected
          ? undefined
          : isAlt
            ? "color-mix(in srgb, var(--color-brand-primary) 2%, var(--color-bg-surface))"
            : undefined,
      }}
    >
      {/* CHECK */}
      <div className="permission-checkbox" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={onToggle} />
      </div>

      {/* NAME */}
      <div className="permission-name text-[var(--color-text-primary)]">
        <StudentNameWithLectureChip
          name={student.student_name ?? ""}
          profilePhotoUrl={student.profile_photo_url ?? undefined}
          avatarSize={24}
          lectures={
            student.lecture_title
              ? [{ lectureName: student.lecture_title, color: student.lecture_color, chipLabel: (student as any).lecture_chip_label }]
              : undefined
          }
          chipSize={14}
          clinicHighlight={(student as any).name_highlight_clinic_target === true}
        />
      </div>

      {/* ATTENDANCE */}
      <div className="w-[90px] flex justify-center">
        <AttendanceStatusBadge
          status={(student.attendance_status ?? "INACTIVE") as AttendanceStatus}
          variant="2ch"
        />
      </div>

      {/* ACCESS MODE */}
      <div className="w-[90px] flex justify-center">
        <Badge
          variant="solid"
          tone={getAccessTone(student.access_mode, student.effective_rule)}
        >
          {getAccessLabel(student.access_mode, student.effective_rule)}
        </Badge>
      </div>

      {/* COMPLETED */}
      <div className="w-[80px] flex justify-center">
        <Badge
          variant="solid"
          tone={student.completed ? "success" : "neutral"}
        >
          {student.completed ? "완료" : "미완"}
        </Badge>
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
      <div className="w-[60px] text-center permission-text-xs">
        {student.grade || "-"}
      </div>
    </div>
  );
}
