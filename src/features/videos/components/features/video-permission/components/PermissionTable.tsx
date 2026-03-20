// PATH: src/features/videos/components/features/video-permission/components/PermissionTable.tsx

import PermissionRow from "./PermissionRow";

export default function PermissionTable({
  students,
  selected: selectedEnrollmentIds,
  toggle,
  toggleAll,
}: {
  students: any[];
  selected: number[];
  toggle: (id: number) => void;
  toggleAll: () => void;
}) {
  const allSelected = students.length > 0 && selectedEnrollmentIds.length === students.length;
  const someSelected = selectedEnrollmentIds.length > 0 && selectedEnrollmentIds.length < students.length;

  return (
    <>
      <div className="permission-table-header">
        <div className="permission-checkbox">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={toggleAll}
          />
        </div>

        <div className="w-[130px]">이름</div>
        <div className="w-[90px] text-center">출석</div>
        <div className="w-[90px] text-center">접근 모드</div>
        <div className="w-[80px] text-center">완료</div>
        <div className="w-[150px]">학부모 번호</div>
        <div className="w-[150px]">학생 번호</div>
        <div className="w-[140px]">학교</div>
        <div className="w-[60px] text-center">학년</div>
      </div>

      <div className="flex-1 overflow-auto">
        {students.map((s: any, idx: number) => (
          <PermissionRow
            key={s.enrollment}
            student={s}
            selected={selectedEnrollmentIds.includes(s.enrollment)}
            onToggle={() => toggle(s.enrollment)}
            isAlt={idx % 2 === 1}
          />
        ))}

        {students.length === 0 && (
          <div
            className="flex items-center justify-center"
            style={{
              padding: "var(--space-8)",
              fontSize: "var(--text-sm, 13px)",
              color: "var(--color-text-muted)",
            }}
          >
            표시할 학생이 없습니다.
          </div>
        )}
      </div>
    </>
  );
}
