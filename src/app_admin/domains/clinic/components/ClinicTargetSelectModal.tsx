// PATH: src/app_admin/domains/clinic/components/ClinicTargetSelectModal.tsx
// 클리닉 생성 — 대상자 선택 모달 (수강대상등록 스타일, 예약 대상자 | 전체 학생 탭)

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "antd";

import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button, EmptyState } from "@/shared/ui/ds";
import { TABLE_COL } from "@/shared/ui/domain";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import type { LectureInfo } from "@/shared/ui/chips/StudentNameWithLectureChip";
import { formatPhone } from "@/shared/utils/formatPhone";

import { useClinicTargets } from "../hooks/useClinicTargets";
import { fetchClinicStudentsPaginated } from "../api/clinicStudents.api";
import type { ClinicTarget } from "../api/clinicTargets";
import type { ClinicStudent } from "../api/clinicStudents.api";
import { useSchoolLevelMode } from "@/shared/hooks/useSchoolLevelMode";

/**
 * 통합 행 타입 — 양쪽 탭에서 동일한 테이블 컬럼 렌더링에 사용
 */
type UnifiedRow = {
  id: number; // targets: enrollment_id, students: student id
  name: string;
  parentPhone: string;
  studentPhone: string;
  school: string;
  grade: number | null;
  schoolType: string;
  profilePhotoUrl: string | null;
  lectures: LectureInfo[];
  clinicHighlight: boolean;
};

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  );
}

/* ── Pagination Icons (SessionEnrollModal SSOT) ── */
const PG_ICON = 20;
function FirstPageIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden width={PG_ICON} height={PG_ICON}><path d="M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6zM6 6h2v12H6z" /></svg>;
}
function PrevPageIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden width={PG_ICON} height={PG_ICON}><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></svg>;
}
function NextPageIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden width={PG_ICON} height={PG_ICON}><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>;
}
function LastPageIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden width={PG_ICON} height={PG_ICON}><path d="M5.59 7.41L10.18 12l-4.59 4.59L7 18l6-6-6-6zM18 6v12h-2V6z" /></svg>;
}

import {
  type EnrollmentSelection,
  type StudentSelection,
  enrollmentSelection,
  studentSelection,
} from "@/shared/types/selection";

export type ClinicTargetSelectResult = EnrollmentSelection | StudentSelection;

type Props = {
  open: boolean;
  onClose: () => void;
  initialMode?: "targets" | "students";
  initialSelectedIds?: number[];
  onConfirm: (result: ClinicTargetSelectResult) => void;
};

const EMPTY_IDS: number[] = [];
const PAGE_SIZE = 50;

/** 학년 표시 (school_type + grade) */
function gradeLabel(schoolType?: string, grade?: number | null): string {
  if (grade == null) return "-";
  const prefix =
    schoolType === "MIDDLE" ? "중" :
    schoolType === "ELEMENTARY" ? "초" :
    "고";
  return `${prefix}${grade}`;
}

/** ClinicTarget → UnifiedRow */
function targetToRow(t: ClinicTarget): UnifiedRow {
  const lectures: LectureInfo[] = t.lecture_title
    ? [{ lectureName: t.lecture_title, color: t.lecture_color, chipLabel: t.lecture_chip_label }]
    : [];
  return {
    id: t.enrollment_id,
    name: t.student_name,
    parentPhone: t.parent_phone || "",
    studentPhone: t.student_phone || "",
    school: t.school || "",
    grade: t.grade ?? null,
    schoolType: t.school_type || "HIGH",
    profilePhotoUrl: t.profile_photo_url ?? null,
    lectures,
    clinicHighlight: t.name_highlight_clinic_target ?? false,
  };
}

/** ClinicStudent → UnifiedRow */
function studentToRow(s: ClinicStudent): UnifiedRow {
  return {
    id: s.id,
    name: s.name,
    parentPhone: s.parent_phone || "",
    studentPhone: s.student_phone || "",
    school: s.school || "",
    grade: s.grade ?? null,
    schoolType: s.school_type || "HIGH",
    profilePhotoUrl: s.profile_photo_url ?? null,
    lectures: s.lectures || [],
    clinicHighlight: false,
  };
}

export default function ClinicTargetSelectModal({
  open,
  onClose,
  initialMode = "targets",
  initialSelectedIds,
  onConfirm,
}: Props) {
  useSchoolLevelMode(); // ensures school level context is consistent with other clinic components
  const stableIds = initialSelectedIds ?? EMPTY_IDS;
  const [mode, setMode] = useState<"targets" | "students">(initialMode);
  const [keyword, setKeyword] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>(() => [...stableIds]);
  const [selectedIdToName, setSelectedIdToName] = useState<Map<number, string>>(new Map());
  const tableRef = useRef<HTMLDivElement>(null);

  const prevOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;
    if (!open || wasOpen) return;
    setMode(initialMode);
    setKeyword("");
    setDebouncedSearch("");
    setPage(1);
    setSelectedIds([...stableIds]);
    setSelectedIdToName(new Map());
  }, [open, initialMode, stableIds]);

  // 검색 디바운스
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(keyword.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [keyword]);

  // ── 대상자 탭: 전체 로드 + 클라이언트 필터/페이징 ──
  const targetsQ = useClinicTargets();

  const allTargetRows: UnifiedRow[] = useMemo(() => {
    const arr = (targetsQ.data ?? []) as ClinicTarget[];
    const filtered = debouncedSearch
      ? arr.filter((t) => (t.student_name || "").includes(debouncedSearch))
      : arr;
    return filtered.map(targetToRow);
  }, [targetsQ.data, debouncedSearch]);

  const targetTotalPages = Math.max(1, Math.ceil(allTargetRows.length / PAGE_SIZE));
  const targetPageRows = useMemo(
    () => allTargetRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [allTargetRows, page],
  );

  // ── 전체 학생 탭: 서버 페이지네이션 ──
  const studentsQ = useQuery({
    queryKey: ["clinic-students-paginated", page, debouncedSearch],
    queryFn: () =>
      fetchClinicStudentsPaginated({
        page,
        page_size: PAGE_SIZE,
        ...(debouncedSearch.length >= 2 ? { search: debouncedSearch } : {}),
      }),
    enabled: open && mode === "students",
    staleTime: 10_000,
    retry: 0,
  });

  const studentRows: UnifiedRow[] = useMemo(
    () => (studentsQ.data?.data ?? []).map(studentToRow),
    [studentsQ.data],
  );
  const studentTotalCount = studentsQ.data?.count ?? 0;
  const studentTotalPages = Math.max(1, Math.ceil(studentTotalCount / PAGE_SIZE));

  // ── 통합 ──
  const rows = mode === "targets" ? targetPageRows : studentRows;
  const totalCount = mode === "targets" ? allTargetRows.length : studentTotalCount;
  const totalPages = mode === "targets" ? targetTotalPages : studentTotalPages;
  const isLoading =
    (mode === "targets" && targetsQ.isLoading) ||
    (mode === "students" && studentsQ.isLoading);

  const allChecked = rows.length > 0 && rows.every((r) => selectedIds.includes(r.id));

  // 페이지 변경 시 테이블 스크롤 맨 위로
  useEffect(() => {
    tableRef.current?.scrollTo({ top: 0 });
  }, [page]);

  const toggleAll = () => {
    if (allChecked) {
      const pageIds = new Set(rows.map((r) => r.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
      setSelectedIdToName((prev) => {
        const next = new Map(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
      return;
    }
    setSelectedIds((prev) => {
      const existing = new Set(prev);
      const added = rows.filter((r) => !existing.has(r.id)).map((r) => r.id);
      return [...prev, ...added];
    });
    setSelectedIdToName((prev) => {
      const next = new Map(prev);
      rows.forEach((r) => next.set(r.id, r.name));
      return next;
    });
  };

  const toggleOne = (id: number, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
    setSelectedIdToName((prev) => {
      const next = new Map(prev);
      if (checked) {
        const row = rows.find((r) => r.id === id);
        if (row) next.set(id, row.name);
      } else next.delete(id);
      return next;
    });
  };

  const removeSelected = (selectedId: number) => {
    setSelectedIds((prev) => prev.filter((x) => x !== selectedId));
    setSelectedIdToName((prev) => {
      const next = new Map(prev);
      next.delete(selectedId);
      return next;
    });
  };

  const selectedRowsForDisplay = useMemo(() => {
    return selectedIds.map((selectedId) => ({ id: selectedId, name: selectedIdToName.get(selectedId) ?? "(이름 없음)" }));
  }, [selectedIds, selectedIdToName]);

  const handleConfirm = () => {
    if (mode === "targets") {
      onConfirm(enrollmentSelection(selectedIds));
    } else {
      onConfirm(studentSelection(selectedIds));
    }
    onClose();
  };

  if (!open) return null;

  return (
    <AdminModal open={true} onClose={onClose} type="action" width={840}>
      <ModalHeader
        type="action"
        title="대상자 선택"
        description="예약 대상자 또는 전체 학생 중 클리닉 대상자를 선택하세요."
      />

      <ModalBody>
        <div
          className="grid gap-4 min-h-0 overflow-hidden ds-split-layout"
          style={{
            gridTemplateColumns: "1fr 220px",
            minHeight: 380,
          }}
        >
          {/* 좌측: 탭 + 검색 + 테이블 + 페이지네이션 */}
          <div className="flex flex-col gap-2 min-h-0 overflow-hidden">
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                className={`ds-choice-btn ds-choice-btn--primary flex-1 ${mode === "targets" ? "is-selected" : ""}`}
                onClick={() => {
                  setMode("targets");
                  setKeyword("");
                  setDebouncedSearch("");
                  setPage(1);
                  // 선택 상태 유지 — 탭 전환 시 초기화하지 않음
                }}
                aria-pressed={mode === "targets"}
              >
                예약 대상자
              </button>
              <button
                type="button"
                className={`ds-choice-btn ds-choice-btn--primary flex-1 ${mode === "students" ? "is-selected" : ""}`}
                onClick={() => {
                  setMode("students");
                  setKeyword("");
                  setDebouncedSearch("");
                  setPage(1);
                  // 선택 상태 유지 — 탭 전환 시 초기화하지 않음
                }}
                aria-pressed={mode === "students"}
              >
                전체 학생
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 shrink-0">
              <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                {mode === "targets" ? "예약 대상자 명단" : "전체 학생 명단"}
              </span>
              {selectedIds.length > 0 && (
                <span className="text-[13px] font-semibold text-[var(--color-brand-primary)]">
                  {selectedIds.length}명 선택됨
                </span>
              )}
            </div>

            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={mode === "students" ? "이름 / 전화번호 / 학교명 / 학년(예: 고1, 중2)" : "대상자 내 검색"}
              allowClear
              className="ds-input w-full text-sm shrink-0"
              aria-label={mode === "students" ? "학생 검색" : "대상자 검색"}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
              <span className="text-[13px] text-[var(--color-text-secondary)]">
                선택된 {selectedIds.length}명 / 전체 {totalCount}명
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  intent="secondary"
                  size="sm"
                  onClick={toggleAll}
                  disabled={isLoading || rows.length === 0}
                >
                  현재 페이지 전체 선택
                </Button>
                <Button
                  type="button"
                  intent="secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedIds([]);
                    setSelectedIdToName(new Map());
                  }}
                  disabled={selectedIds.length === 0}
                >
                  전체 해제
                </Button>
              </div>
            </div>

            {/* 테이블 컨테이너 — 내부 스크롤 */}
            <div
              className="rounded-xl border overflow-hidden flex flex-col flex-1 min-h-0"
              style={{
                borderColor: "var(--color-border-divider)",
                background: "var(--color-bg-surface)",
              }}
            >
              <div
                ref={tableRef}
                className="modal-inner-table overflow-auto flex-1 min-h-0"
              >
                {isLoading ? (
                  <EmptyState
                    mode="embedded"
                    scope="panel"
                    tone="loading"
                    title="불러오는 중…"
                  />
                ) : (
                  <table
                    className="w-full border-collapse"
                    style={{ tableLayout: "fixed" }}
                    role="grid"
                    aria-label={mode === "targets" ? "예약 대상자 명단" : "전체 학생 명단"}
                  >
                    <colgroup>
                      <col style={{ width: TABLE_COL.checkbox }} />
                      <col style={{ width: TABLE_COL.nameCompactModal }} />
                      <col style={{ width: TABLE_COL.phoneCompact }} />
                      <col style={{ width: TABLE_COL.phoneCompact }} />
                      <col style={{ width: TABLE_COL.mediumModal }} />
                      <col style={{ width: TABLE_COL.shortModal }} />
                    </colgroup>
                    <thead>
                      <tr
                        className="sticky top-0 z-10"
                        style={{ background: "var(--color-bg-surface)" }}
                      >
                        <th className="modal-inner-table__checkbox-cell border-b py-1.5 pl-2 pr-1 text-left text-[var(--color-text-muted)]" style={{ borderColor: "var(--color-border-divider)" }}>
                          <input
                            type="checkbox"
                            checked={allChecked}
                            disabled={isLoading || rows.length === 0}
                            onChange={toggleAll}
                            aria-label="현재 페이지 전체 선택"
                          />
                        </th>
                        <th className="modal-inner-table__name-th border-b py-1.5 px-3 text-left text-[var(--color-text-muted)]" style={{ borderColor: "var(--color-border-divider)" }}>이름</th>
                        <th className="border-b py-1.5 px-3 text-left text-[var(--color-text-muted)]" style={{ borderColor: "var(--color-border-divider)" }}>부모님 전화</th>
                        <th className="border-b py-1.5 px-3 text-left text-[var(--color-text-muted)]" style={{ borderColor: "var(--color-border-divider)" }}>학생 전화</th>
                        <th className="border-b py-1.5 px-3 text-left text-[var(--color-text-muted)]" style={{ borderColor: "var(--color-border-divider)" }}>학교</th>
                        <th className="border-b py-1.5 px-3 text-left text-[var(--color-text-muted)]" style={{ borderColor: "var(--color-border-divider)" }}>학년</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-5 px-3 text-center text-[var(--color-text-muted)]">
                            {keyword.trim()
                              ? "검색 결과 없음. 검색어를 바꿔 보세요."
                              : "표시할 대상이 없습니다."}
                          </td>
                        </tr>
                      ) : (
                        rows.map((r) => {
                          const checked = selectedIds.includes(r.id);
                          return (
                            <tr
                              key={r.id}
                              className={`border-b ${checked ? "bg-[var(--color-bg-surface-soft)]" : ""}`}
                              style={{ borderColor: "var(--color-border-divider)" }}
                            >
                              <td className="modal-inner-table__checkbox-cell py-1.5 pl-2 pr-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={isLoading}
                                  onChange={(e) => toggleOne(r.id, e.target.checked)}
                                  aria-label={`${r.name} 선택`}
                                />
                              </td>
                              <td className="modal-inner-table__name py-1.5 px-3 text-[var(--color-text-primary)] truncate font-medium leading-6">
                                <StudentNameWithLectureChip
                                  name={r.name || "(이름 없음)"}
                                  profilePhotoUrl={r.profilePhotoUrl}
                                  avatarSize={20}
                                  lectures={r.lectures}
                                  chipSize={14}
                                  clinicHighlight={r.clinicHighlight}
                                />
                              </td>
                              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] truncate leading-6">{formatPhone(r.parentPhone)}</td>
                              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] truncate leading-6">{formatPhone(r.studentPhone)}</td>
                              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] truncate leading-6">{r.school || "-"}</td>
                              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] leading-6">{gradeLabel(r.schoolType, r.grade)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* 페이지네이션 바 */}
              {totalPages > 1 && (
                <div
                  className="flex items-center justify-between gap-3 py-2 px-3 border-t shrink-0"
                  style={{ borderColor: "var(--color-border-divider)", background: "var(--color-bg-surface)" }}
                >
                  <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                    총 {totalCount}명
                  </span>
                  <div className="flex items-center gap-0.5">
                    <Button type="button" intent="ghost" size="sm" iconOnly leftIcon={<FirstPageIcon />} disabled={page <= 1} onClick={() => setPage(1)} aria-label="첫 페이지" />
                    <Button type="button" intent="ghost" size="sm" iconOnly leftIcon={<PrevPageIcon />} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="이전 페이지" />
                    <span className="text-[13px] font-semibold text-[var(--color-text-primary)] px-2 min-w-[3.5rem] text-center">
                      {page} / {totalPages}
                    </span>
                    <Button type="button" intent="ghost" size="sm" iconOnly leftIcon={<NextPageIcon />} disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="다음 페이지" />
                    <Button type="button" intent="ghost" size="sm" iconOnly leftIcon={<LastPageIcon />} disabled={page >= totalPages} onClick={() => setPage(totalPages)} aria-label="마지막 페이지" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 우측: 선택 목록 */}
          <div
            className="flex flex-col gap-4 rounded-xl border p-4 w-[220px] shrink-0 self-stretch min-h-0 overflow-hidden"
            style={{ borderColor: "var(--color-border-divider)", background: "var(--color-bg-surface)" }}
          >
            <section className="flex flex-col min-h-0 flex-1 overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 mb-2 shrink-0 pl-0.5">
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: selectedIds.length > 0 ? "var(--color-brand-primary)" : "var(--color-text-muted)" }}
                >
                  {selectedIds.length}명 선택됨
                </span>
                <span className="text-[var(--color-border-divider)]" aria-hidden>|</span>
                <Button
                  intent="secondary"
                  size="sm"
                  onClick={() => { setSelectedIds([]); setSelectedIdToName(new Map()); }}
                  disabled={selectedIds.length === 0}
                  className="!text-[13px]"
                >
                  전체 해제
                </Button>
              </div>
              <div
                className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-lg border p-2"
                style={{
                  borderColor: "var(--color-border-divider)",
                  background: "var(--color-bg-surface-soft)",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {selectedRowsForDisplay.length === 0 ? (
                  <p className="text-[13px] text-[var(--color-text-muted)] py-4 text-center">
                    선택한 대상이 없습니다.
                  </p>
                ) : (
                  <ul className="space-y-0">
                    {selectedRowsForDisplay.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-[var(--color-bg-surface)] group min-h-[32px]"
                      >
                        <span className="flex items-center gap-2 min-w-0 flex-1 truncate text-[13px] font-semibold leading-6 text-[var(--color-text-primary)]">
                          {r.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeSelected(r.id)}
                          disabled={isLoading}
                          className="shrink-0 p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] transition-colors disabled:opacity-50"
                          aria-label={`${r.name} 선택 해제`}
                          title="선택 해제"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        right={
          <>
            <Button intent="secondary" onClick={onClose} className="text-[13px]">
              취소
            </Button>
            <Button
              intent="primary"
              className="text-[13px]"
              onClick={handleConfirm}
              title={selectedIds.length === 0 ? "대상을 선택하거나 취소하세요." : undefined}
            >
              선택 확정 ({selectedIds.length}명)
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
