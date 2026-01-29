// PATH: src/features/videos/components/features/video-permission/components/PermissionTable.tsx

import PermissionRow from "./PermissionRow";

export default function PermissionTable({
  students,
  selected,
  toggle,
  toggleAll,
}: {
  students: any[];
  selected: number[];
  toggle: (id: number) => void;
  toggleAll: () => void;
}) {
  return (
    <>
      <div className="permission-table-header">
        <div className="permission-checkbox">
          <input
            type="checkbox"
            checked={
              students.length > 0 && selected.length === students.length
            }
            onChange={toggleAll}
          />
        </div>

        <div className="w-[130px]">이름</div>
        <div className="w-[90px] text-center">출석</div>
        <div className="w-[90px] text-center">권한</div>
        <div className="w-[150px]">학부모 번호</div>
        <div className="w-[150px]">학생 번호</div>
        <div className="w-[140px]">학교</div>
        <div className="w-[60px] text-center">학년</div>
      </div>

      <div className="flex-1 overflow-auto">
        {students.map((s: any) => (
          <PermissionRow
            key={s.enrollment}
            student={s}
            selected={selected.includes(s.enrollment)}
            onToggle={() => toggle(s.enrollment)}
          />
        ))}

        {students.length === 0 && (
          <div className="p-6 text-sm text-[var(--text-muted)]">
            표시할 학생이 없습니다.
          </div>
        )}
      </div>
    </>
  );
}
