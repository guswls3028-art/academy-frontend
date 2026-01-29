// src/features/videos/components/permission/PermissionRow.tsx

import {
  ATT_COLORS,
  ATT_LABELS,
  RULE_COLORS,
  RULE_LABELS,
} from "./permission.constants";

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
      className={`permission-row ${
        selected ? "permission-row-selected" : ""
      }`}
      onClick={onToggle}
      role="button"
      tabIndex={0}
    >
      <div className="permission-checkbox" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
        />
      </div>

      <div className="permission-name">{student.student_name}</div>

      <div className="w-[90px] flex justify-center">
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] text-white ${
            ATT_COLORS[student.attendance_status] || "bg-gray-400"
          }`}
        >
          {ATT_LABELS[student.attendance_status] || "-"}
        </span>
      </div>

      <div className="w-[90px] flex justify-center">
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] text-white ${
            RULE_COLORS[student.effective_rule] || "bg-gray-400"
          }`}
        >
          {RULE_LABELS[student.effective_rule] || "-"}
        </span>
      </div>

      <div className="w-[150px] permission-text-xs">
        {student.parent_phone || "-"}
      </div>
      <div className="w-[150px] permission-text-xs">
        {student.student_phone || "-"}
      </div>
      <div className="w-[140px] permission-text-xs">
        {student.school || "-"}
      </div>
      <div className="w-[60px] text-center text-xs">
        {student.grade || "-"}
      </div>
    </div>
  );
}
