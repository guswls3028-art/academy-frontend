// PATH: src/features/lectures/pages/lectures/LectureStudentsPage.tsx
// 학생 테이블 = 세션 출결 테이블 UI/UX 카피: 강의 뱃지 + 체크박스, 이름, 학부모/학생 전화, N차…1차(역순) 1글자

import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";

import { fetchAttendanceMatrix, downloadAttendanceExcel } from "@/features/lectures/api/attendance";
import { sortSessionsByDateDesc } from "@/features/lectures/api/sessions";
import LectureEnrollStudentModal from "@/features/lectures/components/LectureEnrollStudentModal";
import LectureEnrollExcelModal from "@/features/lectures/components/LectureEnrollExcelModal";
import SessionCreateModal from "@/features/lectures/components/SessionCreateModal";

import AttendanceStatusBadge from "@/shared/ui/badges/AttendanceStatusBadge";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { Button, EmptyState } from "@/shared/ui/ds";
import { DomainListToolbar, DomainTable, STUDENTS_TABLE_COL, ResizableTh, useTableColumnPrefs } from "@/shared/ui/domain";
import type { TableColumnDef } from "@/shared/ui/domain";
import { formatPhone } from "@/shared/utils/formatPhone";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useSendMessageModal } from "@/features/messages/context/SendMessageModalContext";

const LECTURE_STUDENTS_FIXED_COLUMNS: TableColumnDef[] = [
  { key: "name", label: "이름", defaultWidth: STUDENTS_TABLE_COL.name, minWidth: 80 },
  { key: "parentPhone", label: "학부모 전화", defaultWidth: STUDENTS_TABLE_COL.parentPhone, minWidth: 90 },
  { key: "studentPhone", label: "학생 전화", defaultWidth: STUDENTS_TABLE_COL.studentPhone, minWidth: 90 },
  { key: "session", label: "차시", defaultWidth: STUDENTS_TABLE_COL.sessionCol, minWidth: 34 },
];

function LectureStudentsSortableTh({
  colKey,
  label,
  widthKey,
  width,
  sort,
  onSort,
  onWidthChange,
}: {
  colKey: string;
  label: string;
  widthKey: string;
  width: number;
  sort: string;
  onSort: (colKey: string) => void;
  onWidthChange: (key: string, width: number) => void;
}) {
  const isAsc = sort === colKey;
  const isDesc = sort === `-${colKey}`;
  return (
    <ResizableTh
      columnKey={widthKey}
      width={width}
      minWidth={40}
      maxWidth={500}
      onWidthChange={onWidthChange}
      onClick={() => onSort(colKey)}
      aria-sort={isAsc ? "ascending" : isDesc ? "descending" : "none"}
      className="cursor-pointer select-none"
    >
      <span className="inline-flex items-center justify-center gap-2">
        {label}
        <span aria-hidden style={{ fontSize: 11, opacity: isAsc || isDesc ? 1 : 0.35, color: "var(--color-primary)" }}>
          {isAsc ? "▲" : isDesc ? "▼" : "⇅"}
        </span>
      </span>
    </ResizableTh>
  );
}

export default function LectureStudentsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { openSendMessageModal } = useSendMessageModal();
  const { lectureId } = useParams<{ lectureId: string }>();
  const lectureIdNum = Number(lectureId);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showLectureEnroll, setShowLectureEnroll] = useState(false);
  const [showSessionCreateModal, setShowSessionCreateModal] = useState(false);
  const [showEnrollExcelModal, setShowEnrollExcelModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sort, setSort] = useState("");
  const { columnWidths, setColumnWidth } = useTableColumnPrefs("lecture-students", LECTURE_STUDENTS_FIXED_COLUMNS);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: matrix, isLoading } = useQuery({
    queryKey: ["attendance-matrix", lectureIdNum],
    queryFn: () => fetchAttendanceMatrix(lectureIdNum),
    enabled: Number.isFinite(lectureIdNum),
  });

  const { data: lecture } = useQuery({
    queryKey: ["lecture", lectureIdNum],
    queryFn: async () => (await api.get(`/lectures/lectures/${lectureIdNum}/`)).data,
    enabled: Number.isFinite(lectureIdNum),
  });

  const rawStudents = matrix?.students ?? [];
  const sessions = matrix?.sessions ?? [];
  const sessionsByDateDesc = useMemo(() => sortSessionsByDateDesc(sessions), [sessions]);

  // 동명이인 displayName 부여
  const students = useMemo(() => {
    const nameGroups = new Map<string, typeof rawStudents>();
    for (const s of rawStudents) {
      const n = s.name ?? "";
      const group = nameGroups.get(n) ?? [];
      group.push(s);
      nameGroups.set(n, group);
    }
    const displayMap = new Map<number, string>();
    for (const [, group] of nameGroups) {
      if (group.length < 2) continue;
      group.sort((a, b) => (a.student_id ?? 0) - (b.student_id ?? 0));
      for (let i = 0; i < group.length; i++) {
        displayMap.set(group[i].student_id, `${group[i].name}${i + 1}`);
      }
    }
    return rawStudents.map((s) => ({
      ...s,
      displayName: displayMap.get(s.student_id) ?? s.name,
    }));
  }, [rawStudents]);

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const k = search.trim().toLowerCase();
    const digits = search.trim().replace(/\D/g, "");
    return students.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(k) ||
        (s.phone ?? "").replace(/\D/g, "").includes(digits) ||
        (s.parent_phone ?? "").replace(/\D/g, "").includes(digits)
    );
  }, [students, search]);

  const sortedFiltered = useMemo(() => {
    if (!sort) return filtered;
    const key = sort.startsWith("-") ? sort.slice(1) : sort;
    const asc = !sort.startsWith("-");
    return [...filtered].sort((a, b) => {
      const aVal = key === "name" ? (a.name ?? "") : key === "parentPhone" ? (a.parent_phone ?? "") : (a.phone ?? "");
      const bVal = key === "name" ? (b.name ?? "") : key === "parentPhone" ? (b.parent_phone ?? "") : (b.phone ?? "");
      const cmp = String(aVal).localeCompare(String(bVal), "ko");
      return asc ? cmp : -cmp;
    });
  }, [filtered, sort]);

  const handleSort = useCallback((colKey: string) => {
    setSort((prev) => {
      if (prev === colKey) return `-${colKey}`;
      if (prev === `-${colKey}`) return "";
      return colKey;
    });
  }, []);

  const sessionColWidth = columnWidths.session ?? STUDENTS_TABLE_COL.sessionCol;
  const tableMinWidth =
    STUDENTS_TABLE_COL.checkbox +
    (columnWidths.name ?? STUDENTS_TABLE_COL.name) +
    (columnWidths.parentPhone ?? STUDENTS_TABLE_COL.parentPhone) +
    (columnWidths.studentPhone ?? STUDENTS_TABLE_COL.studentPhone) +
    sessionsByDateDesc.length * sessionColWidth;

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allIds = useMemo(() => sortedFiltered.map((s) => s.student_id), [sortedFiltered]);
  const allSelected = sortedFiltered.length > 0 && allIds.every((id) => selectedSet.has(id));

  function toggleSelect(id: number) {
    if (selectedSet.has(id)) setSelectedIds(selectedIds.filter((x) => x !== id));
    else setSelectedIds([...selectedIds, id]);
  }
  function toggleSelectAll() {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds([...allIds]);
  }

  const selectionBar = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 pl-1">
        <span
          className="text-[13px] font-semibold"
          style={{
            color: selectedIds.length > 0 ? "var(--color-primary)" : "var(--color-text-muted)",
          }}
        >
          {selectedIds.length}명 선택됨
        </span>
        <span className="text-[var(--color-border-divider)]">|</span>
        <Button intent="secondary" size="sm" onClick={() => setSelectedIds([])} disabled={selectedIds.length === 0}>
          선택 해제
        </Button>
        <span className="text-[var(--color-border-divider)]">|</span>
        <Button
          intent="secondary"
          size="sm"
          disabled={selectedIds.length === 0}
          onClick={() =>
            openSendMessageModal({
              studentIds: selectedIds,
              recipientLabel: `선택한 수강생 ${selectedIds.length}명`,
              blockCategory: "lecture",
            })
          }
        >
          메시지 발송
        </Button>
      <Button intent="secondary" size="sm" onClick={() => downloadAttendanceExcel(lectureIdNum)}>
        엑셀 다운로드
      </Button>
      </div>
    </div>
  );

  if (!Number.isFinite(lectureIdNum)) {
    return (
      <div className="p-2 text-sm" style={{ color: "var(--color-error)" }}>
        잘못된 lectureId
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <DomainListToolbar
          totalLabel={isLoading ? "…" : `총 ${sortedFiltered.length}명`}
          searchSlot={
            <input
              className="ds-input"
              placeholder="이름 / 전화번호 검색"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ maxWidth: 360 }}
            />
          }
          primaryAction={
            <Button intent="primary" onClick={() => setShowLectureEnroll(true)}>
              수강생 등록
            </Button>
          }
          belowSlot={selectionBar}
        />

        <div>
          {isLoading ? (
            <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
          ) : !sortedFiltered.length ? (
            <EmptyState
              scope="panel"
              tone="empty"
              title="수강 중인 학생이 없습니다."
              description="강의 수강생을 등록한 뒤, 각 차시(1차시, 2차시…) 안으로 들어가서 해당 차시 수강생 등록을 해 주세요."
              actions={
                <Button intent="primary" onClick={() => setShowLectureEnroll(true)}>
                  수강생 등록
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto w-full">
              <div style={{ width: "fit-content" }}>
                <DomainTable
                  tableClassName="ds-table--flat ds-table--attendance"
                  tableStyle={{ width: tableMinWidth, minWidth: tableMinWidth, tableLayout: "fixed" }}
                >
                  <colgroup>
                    <col style={{ width: STUDENTS_TABLE_COL.checkbox }} />
                    <col style={{ width: columnWidths.name ?? STUDENTS_TABLE_COL.name }} />
                    <col style={{ width: columnWidths.parentPhone ?? STUDENTS_TABLE_COL.parentPhone }} />
                    <col style={{ width: columnWidths.studentPhone ?? STUDENTS_TABLE_COL.studentPhone }} />
                    {sessionsByDateDesc.map((s) => (
                      <col key={s.id} style={{ width: sessionColWidth }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col" className="ds-checkbox-cell" style={{ width: STUDENTS_TABLE_COL.checkbox }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          aria-label="전체 선택"
                          className="cursor-pointer"
                        />
                      </th>
                      <LectureStudentsSortableTh
                        colKey="name"
                        label="이름"
                        widthKey="name"
                        width={columnWidths.name ?? STUDENTS_TABLE_COL.name}
                        sort={sort}
                        onSort={handleSort}
                        onWidthChange={setColumnWidth}
                      />
                      <LectureStudentsSortableTh
                        colKey="parentPhone"
                        label="학부모 전화번호"
                        widthKey="parentPhone"
                        width={columnWidths.parentPhone ?? STUDENTS_TABLE_COL.parentPhone}
                        sort={sort}
                        onSort={handleSort}
                        onWidthChange={setColumnWidth}
                      />
                      <LectureStudentsSortableTh
                        colKey="studentPhone"
                        label="학생 전화번호"
                        widthKey="studentPhone"
                        width={columnWidths.studentPhone ?? STUDENTS_TABLE_COL.studentPhone}
                        sort={sort}
                        onSort={handleSort}
                        onWidthChange={setColumnWidth}
                      />
                      {sessionsByDateDesc.map((s) => (
                        <ResizableTh
                          key={s.id}
                          columnKey="session"
                          width={sessionColWidth}
                          minWidth={34}
                          maxWidth={80}
                          onWidthChange={setColumnWidth}
                          className="text-center"
                          style={{ paddingLeft: 0, paddingRight: 0 }}
                          title={`${s.order ?? "-"}차시${s.date ? ` (${s.date})` : ""}`}
                        >
                          {s.order ?? "-"}차
                        </ResizableTh>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFiltered.map((row) => (
                      <tr
                        key={row.student_id}
                        onClick={() => navigate(`/admin/students/${row.student_id}`)}
                        tabIndex={0}
                        role="button"
                        className={`cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]/40 ${selectedSet.has(row.student_id) ? "ds-row-selected" : ""}`}
                      >
                        <td className="ds-checkbox-cell align-middle" style={{ width: STUDENTS_TABLE_COL.checkbox }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedSet.has(row.student_id)}
                            onChange={() => toggleSelect(row.student_id)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`${row.displayName ?? row.name} 선택`}
                            className="cursor-pointer"
                          />
                        </td>
                        <td className="text-[15px] font-bold leading-6 text-[var(--color-text-primary)] truncate align-middle" style={{ width: columnWidths.name ?? STUDENTS_TABLE_COL.name }}>
                          <StudentNameWithLectureChip
                            name={row.displayName ?? row.name ?? ""}
                            profilePhotoUrl={row.profile_photo_url ?? undefined}
                            avatarSize={24}
                            lectures={
                              lecture?.title
                                ? [{ lectureName: lecture.title, color: lecture.color }]
                                : undefined
                            }
                            chipSize={16}
                          />
                        </td>
                        <td className="text-[14px] leading-6 text-[var(--color-text-secondary)] truncate align-middle" style={{ width: columnWidths.parentPhone ?? STUDENTS_TABLE_COL.parentPhone }}>
                          {formatPhone(row.parent_phone)}
                        </td>
                        <td className="text-[14px] leading-6 text-[var(--color-text-secondary)] truncate align-middle" style={{ width: columnWidths.studentPhone ?? STUDENTS_TABLE_COL.studentPhone }}>
                          {formatPhone(row.phone)}
                        </td>
                        {sessionsByDateDesc.map((s) => {
                          const cell = row.attendance[String(s.id)];
                          return (
                            <td
                              key={s.id}
                              className="text-center align-middle px-0"
                              style={{ width: sessionColWidth }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {cell?.status ? (
                                <AttendanceStatusBadge status={cell.status as any} variant="1ch" />
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
          )}
        </div>
      </div>

      <LectureEnrollStudentModal
        lectureId={lectureIdNum}
        open={showLectureEnroll}
        onClose={() => setShowLectureEnroll(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["attendance-matrix", lectureIdNum] });
          setShowLectureEnroll(false);
        }}
        onChooseSessionCreate={() => setShowSessionCreateModal(true)}
        onChooseExcelUpload={() => setShowEnrollExcelModal(true)}
      />

      {showSessionCreateModal && (
        <SessionCreateModal
          lectureId={lectureIdNum}
          onClose={() => setShowSessionCreateModal(false)}
        />
      )}

      <LectureEnrollExcelModal
        lectureId={lectureIdNum}
        lectureTitle={lecture?.title ?? lecture?.name ?? ""}
        open={showEnrollExcelModal}
        onClose={() => setShowEnrollExcelModal(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["attendance-matrix", lectureIdNum] });
          setShowEnrollExcelModal(false);
        }}
      />
    </>
  );
}
