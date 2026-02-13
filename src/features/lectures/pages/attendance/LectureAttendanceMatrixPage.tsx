// PATH: src/features/lectures/pages/attendance/LectureAttendanceMatrixPage.tsx
// Design: 출결 페이지(SessionAttendancePage)와 동일 — DomainTable, ds-table--attendance, students SSOT 폰트
// 컬럼: 체크박스, 이름, 학부모 전화, 학생 전화, 출결블록(N차 → 1차 역순, 1글자)
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  fetchAttendanceMatrix,
  downloadAttendanceExcel,
  type AttendanceMatrixResponse,
} from "@/features/lectures/api/attendance";
import AttendanceStatusBadge from "@/shared/ui/badges/AttendanceStatusBadge";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { EmptyState, Button } from "@/shared/ui/ds";
import { DomainListToolbar, DomainTable } from "@/shared/ui/domain";
import { formatPhone } from "@/shared/utils/formatPhone";

const SESSION_COL_WIDTH = 28;

export default function LectureAttendanceMatrixPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const lectureIdNum = Number(lectureId);

  const { data, isLoading } = useQuery<AttendanceMatrixResponse>({
    queryKey: ["attendance-matrix", lectureIdNum],
    queryFn: () => fetchAttendanceMatrix(lectureIdNum),
    enabled: Number.isFinite(lectureIdNum),
  });

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!data?.students?.length)
    return (
      <EmptyState
        scope="panel"
        title="출결 데이터가 없습니다."
        description="차시에 수강생을 등록한 뒤 출결을 기록하면 표시됩니다."
      />
    );

  const { lecture: lectureInfo, sessions, students } = data;
  // 차시 출결 페이지와 동일 정합: order 기준 1…N 정렬 후 역순 → N차, N-1차, …, 1차 (왼쪽이 최신)
  const sessionsReversed = [...sessions]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .reverse();

  const col = {
    checkbox: 44,
    name: 92,
    parentPhone: 104,
    studentPhone: 104,
  };
  const sessionColsTotal = sessionsReversed.length * SESSION_COL_WIDTH;
  const tableMinWidth = col.checkbox + col.name + col.parentPhone + col.studentPhone + sessionColsTotal;

  const primaryAction = (
    <Button
      type="button"
      intent="secondary"
      size="sm"
      onClick={() => downloadAttendanceExcel(lectureIdNum)}
    >
      엑셀 다운로드
    </Button>
  );

  return (
    <div className="flex flex-col gap-3">
      <DomainListToolbar
        totalLabel={`총 ${students.length}명`}
        searchSlot={<span className="flex-1" />}
        primaryAction={primaryAction}
      />
      <div className="overflow-x-auto w-full">
        <div style={{ width: "fit-content" }}>
          <DomainTable
            tableClassName="ds-table--flat ds-table--attendance"
            tableStyle={{ width: tableMinWidth, minWidth: tableMinWidth, tableLayout: "fixed" }}
          >
            <colgroup>
              <col style={{ width: col.checkbox }} />
              <col style={{ width: col.name }} />
              <col style={{ width: col.parentPhone }} />
              <col style={{ width: col.studentPhone }} />
              {sessionsReversed.map((s) => (
                <col key={s.id} style={{ width: SESSION_COL_WIDTH }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="ds-checkbox-cell" style={{ width: col.checkbox }}>
                  <span className="sr-only">선택</span>
                </th>
                <th scope="col" style={{ width: col.name }}>
                  이름
                </th>
                <th scope="col" style={{ width: col.parentPhone }}>
                  학부모 전화번호
                </th>
                <th scope="col" style={{ width: col.studentPhone }}>
                  학생 전화번호
                </th>
                {sessionsReversed.map((s) => (
                  <th
                    key={s.id}
                    scope="col"
                    className="text-center"
                    style={{ width: SESSION_COL_WIDTH }}
                    title={`${s.order ?? "-"}차시${s.date ? ` (${s.date})` : ""}`}
                  >
                    {s.order ?? "-"}차
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((row) => (
                <tr key={row.student_id} className="hover:bg-[var(--color-bg-surface-hover)]">
                  <td className="ds-checkbox-cell align-middle" style={{ width: col.checkbox }}>
                    <span className="sr-only">{row.name} 선택</span>
                  </td>
                    <td
                    className="text-[15px] font-bold leading-6 text-[var(--color-text-primary)] truncate align-middle"
                    style={{ width: col.name }}
                  >
                    <StudentNameWithLectureChip
                      name={row.name ?? ""}
                      lectures={
                        lectureInfo
                          ? [{ lectureName: lectureInfo.title, color: lectureInfo.color }]
                          : []
                      }
                      chipSize={16}
                    />
                  </td>
                  <td
                    className="text-[14px] leading-6 text-[var(--color-text-secondary)] truncate align-middle"
                    style={{ width: col.parentPhone }}
                  >
                    {formatPhone(row.parent_phone)}
                  </td>
                  <td
                    className="text-[14px] leading-6 text-[var(--color-text-secondary)] truncate align-middle"
                    style={{ width: col.studentPhone }}
                  >
                    {formatPhone(row.phone)}
                  </td>
                  {sessionsReversed.map((s) => {
                    const cell = row.attendance[String(s.id)];
                    return (
                      <td
                        key={s.id}
                        className="text-center align-middle px-0"
                        style={{ width: SESSION_COL_WIDTH }}
                      >
                        {cell?.status ? (
                          <AttendanceStatusBadge
                            status={cell.status as any}
                            variant="short"
                          />
                        ) : (
                          <span className="text-[var(--color-text-muted)] text-[10px]">－</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </DomainTable>
        </div>
      </div>
    </div>
  );
}
