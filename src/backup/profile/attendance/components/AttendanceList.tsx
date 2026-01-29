// PATH: src/features/profile/attendance/components/AttendanceList.tsx
import { PageSection } from "@/shared/ui/page";
import { EmptyState } from "@/shared/ui/feedback";
import AttendanceTable from "@/features/profile/components/AttendanceTable";
import { Attendance } from "@/features/profile/api/profile";

export default function AttendanceList({
  rows,
  isLoading,
  onCreate,
  onEdit,
  onDelete,
}: {
  rows: Attendance[];
  isLoading: boolean;
  onCreate: () => void;
  onEdit: (r: Attendance) => void;
  onDelete: (r: Attendance) => void;
}) {
  return (
    <PageSection
      title="근태 기록"
      right={
        <button onClick={onCreate} className="btn-primary text-sm">
          + 근태 등록
        </button>
      }
    >
      {isLoading && (
        <div className="text-sm text-muted">불러오는 중...</div>
      )}

      {!isLoading && rows.length === 0 && (
        <EmptyState
          title="근태 기록 없음"
          message="선택한 월에 등록된 근태 기록이 없습니다."
        />
      )}

      {!!rows.length && (
        <AttendanceTable
          rows={rows}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </PageSection>
  );
}
