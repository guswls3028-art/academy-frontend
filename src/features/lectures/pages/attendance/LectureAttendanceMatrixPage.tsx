// PATH: src/features/lectures/pages/attendance/LectureAttendanceMatrixPage.tsx
// Design: docs/DESIGN_SSOT.md
// 컬럼: 이름, 학부모 전화, 학생 전화, 출결블록(1차 → N차 순서, 1글자)
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
import { DomainListToolbar, DomainTable, STUDENTS_TABLE_COL, ResizableTh, useTableColumnPrefs } from "@/shared/ui/domain";
import type { TableColumnDef } from "@/shared/ui/domain";
import { formatPhone } from "@/shared/utils/formatPhone";
import { useMemo } from "react";

const LECTURE_ATTENDANCE_MATRIX_COLUMNS: TableColumnDef[] = [
  { key: "name", label: "이름", defaultWidth: STUDENTS_TABLE_COL.name, minWidth: 80 },
  { key: "parentPhone", label: "학부모 전화", defaultWidth: STUDENTS_TABLE_COL.parentPhone, minWidth: 90 },
  { key: "studentPhone", label: "학생 전화", defaultWidth: STUDENTS_TABLE_COL.studentPhone, minWidth: 90 },
];

const SESSION_COL_WIDTH = 40;

export default function LectureAttendanceMatrixPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const lectureIdNum = Number(lectureId);
  const { columnWidths, setColumnWidth } = useTableColumnPrefs("lecture-attendance-matrix", LECTURE_ATTENDANCE_MATRIX_COLUMNS);

  const { data, isLoading } = useQuery<AttendanceMatrixResponse>({
    queryKey: ["attendance-matrix", lectureIdNum],
    queryFn: () => fetchAttendanceMatrix(lectureIdNum),
    enabled: Number.isFinite(lectureIdNum),
  });

  // 차시 블록: order 오름차순 (1차시 → N차시)
  const sessionsAsc = useMemo(() => {
    if (!data?.sessions) return [];
    return [...data.sessions].sort((a, b) => {
      const oa = a.order ?? 9999;
      const ob = b.order ?? 9999;
      if (oa !== ob) return oa - ob;
      return (a.date || "").localeCompare(b.date || "");
    });
  }, [data]);

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중..." />;
  if (!data?.students?.length)
    return (
      <EmptyState
        scope="panel"
        tone="empty"
        title="출결 데이터가 없습니다."
        description="차시에 수강생을 등록한 뒤 출결을 기록하면 표시됩니다."
      />
    );

  const { lecture: lectureInfo, students } = data;
  const col = STUDENTS_TABLE_COL;

  const fixedWidth =
    (columnWidths.name ?? col.name) +
    (columnWidths.parentPhone ?? col.parentPhone) +
    (columnWidths.studentPhone ?? col.studentPhone);
  const sessionColsTotal = sessionsAsc.length * SESSION_COL_WIDTH;
  const tableMinWidth = fixedWidth + sessionColsTotal;

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
              <col style={{ width: columnWidths.name ?? col.name }} />
              <col style={{ width: columnWidths.parentPhone ?? col.parentPhone }} />
              <col style={{ width: columnWidths.studentPhone ?? col.studentPhone }} />
              {sessionsAsc.map((s) => (
                <col key={s.id} style={{ width: SESSION_COL_WIDTH }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <ResizableTh
                  columnKey="name"
                  width={columnWidths.name ?? col.name}
                  minWidth={80}
                  maxWidth={500}
                  onWidthChange={setColumnWidth}
                  className="text-left"
                >
                  이름
                </ResizableTh>
                <ResizableTh
                  columnKey="parentPhone"
                  width={columnWidths.parentPhone ?? col.parentPhone}
                  minWidth={90}
                  maxWidth={400}
                  onWidthChange={setColumnWidth}
                  className="text-center"
                >
                  학부모
                </ResizableTh>
                <ResizableTh
                  columnKey="studentPhone"
                  width={columnWidths.studentPhone ?? col.studentPhone}
                  minWidth={90}
                  maxWidth={400}
                  onWidthChange={setColumnWidth}
                  className="text-center"
                >
                  학생
                </ResizableTh>
                {sessionsAsc.map((s, idx) => (
                  <th
                    key={s.id}
                    scope="col"
                    className="text-center"
                    style={{
                      width: SESSION_COL_WIDTH,
                      padding: "6px 0",
                      fontWeight: 600,
                      fontSize: 12,
                      color: "var(--color-text-muted)",
                      borderLeft: idx === 0 ? "1px solid var(--color-border-divider)" : undefined,
                    }}
                    title={`${s.order ?? "-"}차시${s.date ? ` (${s.date})` : ""}`}
                  >
                    {s.order ?? "-"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((row) => (
                <tr key={row.student_id} className="hover:bg-[var(--color-bg-surface-hover)]">
                  <td
                    className="text-[15px] font-bold leading-6 text-[var(--color-text-primary)] truncate align-middle"
                    style={{ width: columnWidths.name ?? col.name }}
                  >
                    <StudentNameWithLectureChip
                      name={row.name ?? ""}
                      profilePhotoUrl={row.profile_photo_url ?? undefined}
                      avatarSize={24}
                      lectures={
                        lectureInfo
                          ? [{ lectureName: lectureInfo.title, color: lectureInfo.color, chipLabel: (lectureInfo as any).chip_label }]
                          : undefined
                      }
                      chipSize={16}
                      clinicHighlight={(row as any).name_highlight_clinic_target === true}
                    />
                  </td>
                  <td
                    className="text-[13px] leading-6 text-[var(--color-text-secondary)] truncate align-middle text-center"
                    style={{ width: columnWidths.parentPhone ?? col.parentPhone }}
                  >
                    {formatPhone(row.parent_phone)}
                  </td>
                  <td
                    className="text-[13px] leading-6 text-[var(--color-text-secondary)] truncate align-middle text-center"
                    style={{ width: columnWidths.studentPhone ?? col.studentPhone }}
                  >
                    {formatPhone(row.phone)}
                  </td>
                  {sessionsAsc.map((s, idx) => {
                    const cell = row.attendance[String(s.id)];
                    return (
                      <td
                        key={s.id}
                        className="text-center align-middle"
                        style={{
                          width: SESSION_COL_WIDTH,
                          padding: "4px 0",
                          borderLeft: idx === 0 ? "1px solid var(--color-border-divider)" : undefined,
                        }}
                      >
                        {cell?.status ? (
                          <AttendanceStatusBadge
                            status={cell.status as any}
                            variant="1ch"
                          />
                        ) : (
                          <span style={{ color: "var(--color-border-divider)", fontSize: 8 }}>·</span>
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
