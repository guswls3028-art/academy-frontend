// PATH: src/features/lectures/pages/lectures/LectureStudentsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchLectureStudents, type LectureStudent } from "@/features/lectures/api/students";
import LectureEnrollStudentModal from "@/features/lectures/components/LectureEnrollStudentModal";

import { Button, EmptyState } from "@/shared/ui/ds";
import { DomainListToolbar, DomainTable } from "@/shared/ui/domain";
import { feedback } from "@/shared/ui/feedback/feedback";

export default function LectureStudentsPage() {
  const navigate = useNavigate();
  const { lectureId } = useParams<{ lectureId: string }>();
  const lectureIdNum = Number(lectureId);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showEnroll, setShowEnroll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: students = [], isLoading } = useQuery<LectureStudent[]>({
    queryKey: ["lecture-students", lectureIdNum],
    queryFn: () => fetchLectureStudents(lectureIdNum),
    enabled: Number.isFinite(lectureIdNum),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const k = search.trim().toLowerCase();
    return students.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(k) ||
        (s.school || "").toLowerCase().includes(k) ||
        String(s.grade ?? "").includes(k)
    );
  }, [students, search]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allIds = useMemo(() => filtered.map((s) => s.id), [filtered]);
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
          totalLabel={isLoading ? "…" : `총 ${filtered.length}명`}
          searchSlot={
            <input
              className="ds-input"
              placeholder="이름 / 학교 / 학년 검색"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ maxWidth: 360 }}
            />
          }
          primaryAction={
            <Button intent="primary" onClick={() => setShowEnroll(true)}>
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
              description="수강생 등록 버튼으로 학생을 추가하거나, 검색 조건을 변경해 보세요."
              actions={
                <Button intent="primary" onClick={() => setShowEnroll(true)}>
                  수강생 등록
                </Button>
              }
            />
          ) : (
            <DomainTable tableClassName="ds-table--flat" tableStyle={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: 48 }} />
                <col style={{ width: 256 }} />
                <col style={{ width: 100 }} />
                <col />
                <col style={{ width: 120 }} />
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
                  <th scope="col">학년</th>
                  <th scope="col">학교</th>
                  <th scope="col">상태</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/admin/students/${s.id}`)}
                    tabIndex={0}
                    role="button"
                    className={`cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]/40 ${selectedSet.has(s.id) ? "ds-row-selected" : ""}`}
                  >
                    <td className="ds-checkbox-cell" style={{ width: 48 }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedSet.has(s.id)}
                        onChange={() => toggleSelect(s.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`${s.name} 선택`}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="text-[15px] font-bold text-[var(--color-text-primary)] truncate">
                      {s.name}
                    </td>
                    <td className="text-[14px] text-[var(--color-text-secondary)] truncate text-center">
                      {s.grade ?? "-"}
                    </td>
                    <td className="text-[14px] text-[var(--color-text-secondary)] truncate">
                      {s.school ?? "-"}
                    </td>
                    <td className="text-[13px] font-semibold text-[var(--color-text-muted)] truncate text-center">
                      {s.status_label}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DomainTable>
          )}
        </div>
      </div>

      <LectureEnrollStudentModal
        lectureId={lectureIdNum}
        open={showEnroll}
        onClose={() => setShowEnroll(false)}
        onSuccess={() => setShowEnroll(false)}
      />
    </>
  );
}
