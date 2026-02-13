// PATH: src/features/lectures/pages/lectures/LectureStudentsPage.tsx
// 강의 수강생 = 세션(차시)에 등록된 학생 전체. 차시별 출결 매트릭스 테이블 + 차시별 수강생 등록.

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchAttendanceMatrix } from "@/features/lectures/api/attendance";
import LectureEnrollStudentModal from "@/features/lectures/components/LectureEnrollStudentModal";

import AttendanceStatusBadge from "@/shared/ui/badges/AttendanceStatusBadge";
import { Button, EmptyState } from "@/shared/ui/ds";
import { DomainListToolbar, DomainTable } from "@/shared/ui/domain";
import { feedback } from "@/shared/ui/feedback/feedback";

export default function LectureStudentsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { lectureId } = useParams<{ lectureId: string }>();
  const lectureIdNum = Number(lectureId);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showLectureEnroll, setShowLectureEnroll] = useState(false);
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

  const students = matrix?.students ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const k = search.trim().toLowerCase();
    return students.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(k) ||
        (s.phone ?? "").replace(/\s/g, "").includes(k)
    );
  }, [students, search]);

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
      <Button intent="secondary" size="sm" onClick={() => feedback.info("메시지 발송 기능 준비 중입니다.")}>
        메시지 발송
      </Button>
      <Button intent="secondary" size="sm" onClick={() => feedback.info("엑셀 다운로드 기능 준비 중입니다.")}>
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
          totalLabel={isLoading ? "…" : `총 ${filtered.length}명 (차시에 등록된 수강생)`}
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
            <DomainTable
              tableClassName="ds-table--flat"
              tableStyle={{ tableLayout: "auto", minWidth: 800 }}
            >
              <colgroup>
                <col style={{ width: 48 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 110 }} />
                {(matrix?.sessions ?? []).map((_, i) => (
                  <col key={i} style={{ width: 44 }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="ds-checkbox-cell" style={{ width: 48 }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="전체 선택"
                      className="cursor-pointer"
                    />
                  </th>
                  <th scope="col">이름</th>
                  <th scope="col">연락처</th>
                  {(matrix?.sessions ?? []).map((s) => (
                    <th
                      key={s.id}
                      scope="col"
                      className="text-center text-xs font-semibold text-[var(--color-text-muted)]"
                      style={{ width: 44 }}
                    >
                      {s.order}차
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
                    <td className="ds-checkbox-cell" style={{ width: 48 }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedSet.has(row.student_id)}
                        onChange={() => toggleSelect(row.student_id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`${row.name} 선택`}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="text-[15px] font-bold text-[var(--color-text-primary)] truncate">
                      {row.name}
                    </td>
                    <td className="text-[13px] text-[var(--color-text-secondary)] truncate">
                      {row.phone ?? "-"}
                    </td>
                    {(matrix?.sessions ?? []).map((s) => {
                      const cell = row.attendance[String(s.id)];
                      return (
                        <td
                          key={s.id}
                          className="text-center align-middle py-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {cell?.status ? (
                            <AttendanceStatusBadge
                              status={cell.status as any}
                              variant="short"
                            />
                          ) : (
                            <span className="text-[var(--color-text-muted)] text-xs">－</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </DomainTable>
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
      />
    </>
  );
}
