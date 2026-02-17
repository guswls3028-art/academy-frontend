// PATH: src/features/lectures/pages/lectures/LectureStudentsPage.tsx
// 학생 테이블 = 세션 출결 테이블 UI/UX 카피: 강의 뱃지 + 체크박스, 이름, 학부모/학생 전화, N차…1차(역순) 1글자

import { useEffect, useMemo, useState } from "react";
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
import { DomainListToolbar, DomainTable, STUDENTS_TABLE_COL } from "@/shared/ui/domain";
import { formatPhone } from "@/shared/utils/formatPhone";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useSendMessageModal } from "@/features/messages/context/SendMessageModalContext";

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

  const students = matrix?.students ?? [];
  const sessions = matrix?.sessions ?? [];
  const sessionsByDateDesc = useMemo(() => sortSessionsByDateDesc(sessions), [sessions]);

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

  const col = STUDENTS_TABLE_COL;
  const tableMinWidth =
    col.checkbox + col.name + col.parentPhone + col.studentPhone + sessionsByDateDesc.length * col.sessionCol;

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allIds = useMemo(() => filtered.map((s) => s.student_id), [filtered]);
  const allSelected = filtered.length > 0 && allIds.every((id) => selectedSet.has(id));

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
            })
          }
        >
          메시지 발송
        </Button>
      <Button intent="secondary" size="sm" onClick={() => downloadAttendanceExcel(lectureIdNum)}>
        엑셀 다운로드
      </Button>
      <Button intent="secondary" size="sm" onClick={() => feedback.info("태그 추가 기능 준비 중입니다.")}>
        태그 추가
      </Button>
      <Button intent="secondary" size="sm" onClick={() => feedback.info("비밀번호 변경 기능 준비 중입니다.")}>
        비밀번호 변경
      </Button>
      <Button intent="danger" size="sm" onClick={() => feedback.info("일괄 삭제 기능 준비 중입니다.")}>
        삭제
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
          totalLabel={isLoading ? "…" : `총 ${filtered.length}명`}
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
          ) : !filtered.length ? (
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
                    <col style={{ width: col.checkbox }} />
                    <col style={{ width: col.name }} />
                    <col style={{ width: col.parentPhone }} />
                    <col style={{ width: col.studentPhone }} />
                    {sessionsByDateDesc.map((s) => (
                      <col key={s.id} style={{ width: col.sessionCol }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col" className="ds-checkbox-cell" style={{ width: col.checkbox }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          aria-label="전체 선택"
                          className="cursor-pointer"
                        />
                      </th>
                      <th scope="col" style={{ width: col.name }}>이름</th>
                      <th scope="col" style={{ width: col.parentPhone }}>학부모 전화번호</th>
                      <th scope="col" style={{ width: col.studentPhone }}>학생 전화번호</th>
                      {sessionsByDateDesc.map((s) => (
                        <th
                          key={s.id}
                          scope="col"
                          className="text-center"
                          style={{ width: col.sessionCol }}
                          title={`${s.order ?? "-"}차시${s.date ? ` (${s.date})` : ""}`}
                        >
                          {s.order ?? "-"}차
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <tr
                        key={row.student_id}
                        onClick={() => navigate(`/admin/students/${row.student_id}`)}
                        tabIndex={0}
                        role="button"
                        className={`cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]/40 ${selectedSet.has(row.student_id) ? "ds-row-selected" : ""}`}
                      >
                        <td className="ds-checkbox-cell align-middle" style={{ width: col.checkbox }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedSet.has(row.student_id)}
                            onChange={() => toggleSelect(row.student_id)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`${row.name} 선택`}
                            className="cursor-pointer"
                          />
                        </td>
                        <td className="text-[15px] font-bold leading-6 text-[var(--color-text-primary)] truncate align-middle" style={{ width: col.name }}>
                          <StudentNameWithLectureChip
                            name={row.name ?? ""}
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
                        <td className="text-[14px] leading-6 text-[var(--color-text-secondary)] truncate align-middle" style={{ width: col.parentPhone }}>
                          {formatPhone(row.parent_phone)}
                        </td>
                        <td className="text-[14px] leading-6 text-[var(--color-text-secondary)] truncate align-middle" style={{ width: col.studentPhone }}>
                          {formatPhone(row.phone)}
                        </td>
                        {sessionsByDateDesc.map((s) => {
                          const cell = row.attendance[String(s.id)];
                          return (
                            <td
                              key={s.id}
                              className="text-center align-middle px-0"
                              style={{ width: col.sessionCol }}
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
