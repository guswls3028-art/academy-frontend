// PATH: src/features/videos/components/features/video-permission/components/PermissionRow.tsx

import AttendanceBadge from "@/shared/ui/attendance/AttendanceBadge";
import { RULE_COLORS, RULE_LABELS } from "../permission.constants";

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

      {/* NAME */}
      <div className="permission-name text-[var(--text-primary)]">
        {student.student_name}
      </div>

      {/* ✅ ATTENDANCE (공용 컴포넌트로 통일) */}
      <div className="w-[90px] flex justify-center">
        <div className="scale-[0.92] origin-center">
          <AttendanceBadge status={student.attendance_status ?? "UNKNOWN"} />
        </div>
      </div>

      {/* RULE */}
      <div className="w-[90px] flex justify-center">
        <Pill className={[RULE_COLORS[student.effective_rule] || "bg-gray-500", "text-white"].join(" ")}>
          {RULE_LABELS[student.effective_rule] || "-"}
        </Pill>
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
