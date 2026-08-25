// PATH: src/app_admin/domains/clinic/components/ClinicTargetSelectModal.tsx
// 클리닉 생성 — 대상자 선택 모달 (수강대상등록 스타일, 예약 대상자 | 전체 학생 탭)

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Input } from "antd";

import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button, EmptyState } from "@/shared/ui/ds";
import { TABLE_COL } from "@/shared/ui/domain";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import StudentsDetailOverlay from "@admin/domains/students/public/StudentsDetailOverlay";
import type { LectureInfo } from "@/shared/ui/chips/StudentNameWithLectureChip";
import { formatPhone } from "@/shared/utils/formatPhone";
import { compareKoreanText } from "@/shared/utils/dataOrdering";

import { useClinicTargets } from "../hooks/useClinicTargets";
import { fetchClinicStudentsPaginated } from "../api/clinicStudents.api";
import type { ClinicTarget } from "../api/clinicTargets";
import type { ClinicStudent } from "../api/clinicStudents.api";
import { useSchoolLevelMode } from "@/shared/hooks/useSchoolLevelMode";
import { clinicQueryKeys } from "../queryKeys";
import "./ClinicTargetSelectModal.css";

/**
 * 통합 행 타입 — 양쪽 탭에서 동일한 테이블 컬럼 렌더링에 사용
 */
type UnifiedRow = {
  id: number; // targets: enrollment_id, students: student id
  studentId: number | null;
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

type ClinicTargetSelectionNames = {
  readonly selectedNames: readonly string[];
};

export type ClinicTargetSelectResult =
  | (EnrollmentSelection & ClinicTargetSelectionNames)
  | (StudentSelection & ClinicTargetSelectionNames);

type Props = {
  open: boolean;
  onClose: () => void;
  initialMode?: "targets" | "students";
  initialSelectedIds?: number[];
  initialSelectedNames?: readonly string[];
  onConfirm: (result: ClinicTargetSelectResult) => void;
};

const EMPTY_IDS: number[] = [];
const EMPTY_NAMES: readonly string[] = [];
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
    studentId: t.student_id ?? null,
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

function targetRowsByStudent(targets: ClinicTarget[]): UnifiedRow[] {
  const rows = new Map<string, UnifiedRow>();

  for (const target of targets) {
    const next = targetToRow(target);
    // 클리닉 예약은 한 세션에 학생 1명당 한 건이다. 학생 ID가 있는 현재
    // 응답은 수강 ID가 달라도 한 행으로 묶고, 구형 응답만 수강 ID로 격리한다.
    const rowKey = next.studentId != null && next.studentId > 0
      ? `student:${next.studentId}`
      : `enrollment:${next.id}`;
    const existing = rows.get(rowKey);
    if (!existing) {
      rows.set(rowKey, next);
      continue;
    }

    const lectureKeys = new Set(
      existing.lectures.map((lecture) =>
        [lecture.lectureName, lecture.color, lecture.chipLabel].join("|")
      )
    );
    for (const lecture of next.lectures) {
      const key = [lecture.lectureName, lecture.color, lecture.chipLabel].join("|");
      if (!lectureKeys.has(key)) {
        existing.lectures.push(lecture);
        lectureKeys.add(key);
      }
    }
    existing.clinicHighlight = existing.clinicHighlight || next.clinicHighlight;
    existing.profilePhotoUrl = existing.profilePhotoUrl || next.profilePhotoUrl;
  }

  return Array.from(rows.values());
}

/** ClinicStudent → UnifiedRow */
function studentToRow(s: ClinicStudent): UnifiedRow {
  return {
    id: s.id,
    studentId: s.id,
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
  initialSelectedNames,
  onConfirm,
}: Props) {
  useSchoolLevelMode(); // ensures school level context is consistent with other clinic components
  const stableIds = initialSelectedIds ?? EMPTY_IDS;
  const stableNames = initialSelectedNames ?? EMPTY_NAMES;
  const [mode, setMode] = useState<"targets" | "students">(initialMode);
  const [keyword, setKeyword] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [nameOrdering, setNameOrdering] = useState<"name" | "-name">("name");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>(() => [...stableIds]);
  const [selectedIdToName, setSelectedIdToName] = useState<Map<number, string>>(new Map());
  const [detailStudentId, setDetailStudentId] = useState<number | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const prevOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;
    if (!open || wasOpen) return;
    setMode(initialMode);
    setKeyword("");
    setDebouncedSearch("");
    setNameOrdering("name");
    setPage(1);
    setSelectedIds([...stableIds]);
    setSelectedIdToName(new Map(
      stableIds.flatMap((selectedId, index) => {
        const selectedName = stableNames[index]?.trim();
        return selectedName ? [[selectedId, selectedName] as const] : [];
      }),
    ));
    setDetailStudentId(null);
  }, [open, initialMode, stableIds, stableNames]);

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
    const uniqueRows = targetRowsByStudent(arr);
    const filtered = debouncedSearch
      ? uniqueRows.filter((row) => row.name.includes(debouncedSearch))
      : uniqueRows;
    return filtered.sort((left, right) => {
      const compared = compareKoreanText(left.name, right.name);
      return (nameOrdering === "name" ? compared : -compared) || left.id - right.id;
    });
  }, [targetsQ.data, debouncedSearch, nameOrdering]);

  const targetTotalPages = Math.max(1, Math.ceil(allTargetRows.length / PAGE_SIZE));
  const targetPageRows = useMemo(
    () => allTargetRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [allTargetRows, page],
  );

  // ── 전체 학생 탭: 서버 페이지네이션 ──
  const studentsQ = useQuery({
    queryKey: clinicQueryKeys.studentsPaginated(page, debouncedSearch, nameOrdering),
    queryFn: () =>
      fetchClinicStudentsPaginated({
        page,
        page_size: PAGE_SIZE,
        ordering: nameOrdering === "name" ? "name,id" : "-name,-id",
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

  const switchMode = (nextMode: "targets" | "students") => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setKeyword("");
    setDebouncedSearch("");
    setPage(1);
    // enrollment_id와 student_id는 서로 다른 식별자다. 한 선택
    // 결과에 섞지 않고, 사용자가 현재 보고 있는 목록만 확정한다.
    setSelectedIds([]);
    setSelectedIdToName(new Map());
  };

  // ── 통합 ──
  const rows = mode === "targets" ? targetPageRows : studentRows;
  const totalCount = mode === "targets" ? allTargetRows.length : studentTotalCount;
  const totalPages = mode === "targets" ? targetTotalPages : studentTotalPages;
  const isLoading =
    (mode === "targets" && targetsQ.isLoading) ||
    (mode === "students" && studentsQ.isLoading);
  const isError =
    (mode === "targets" && targetsQ.isError) ||
    (mode === "students" && studentsQ.isError);

  const retryCurrentList = () => {
    if (mode === "targets") void targetsQ.refetch();
    else void studentsQ.refetch();
  };

  const allChecked = rows.length > 0 && rows.every((r) => selectedIds.includes(r.id));

  useEffect(() => {
    const visibleRows = mode === "targets" ? allTargetRows : studentRows;
    setSelectedIdToName((prev) => {
      const next = new Map(prev);
      visibleRows.forEach((row) => {
        if (selectedIds.includes(row.id)) next.set(row.id, row.name);
      });
      return next;
    });
  }, [allTargetRows, mode, selectedIds, studentRows]);

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
    setSelectedIds((prev) =>
      checked
        ? (prev.includes(id) ? prev : [...prev, id])
        : prev.filter((x) => x !== id)
    );
    setSelectedIdToName((prev) => {
      const next = new Map(prev);
      if (checked) {
        const row = rows.find((r) => r.id === id);
        if (row) next.set(id, row.name);
      } else next.delete(id);
      return next;
    });
  };

  const selectAllTargets = () => {
    if (mode !== "targets") return;
    const ids = Array.from(new Set(allTargetRows.map((r) => r.id)));
    setSelectedIds(ids);
    setSelectedIdToName(() => {
      const next = new Map<number, string>();
      allTargetRows.forEach((r) => next.set(r.id, r.name));
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
    if (isError || selectedIds.length === 0) return;
    const selectedNames = selectedRowsForDisplay.map((row) => row.name);
    if (mode === "targets") {
      onConfirm({ ...enrollmentSelection(selectedIds), selectedNames });
    } else {
      onConfirm({ ...studentSelection(selectedIds), selectedNames });
    }
    onClose();
  };

  if (!open) return null;

  return (
    <>
    <AdminModal open={true} onClose={onClose} type="action" width={840}>
      <ModalHeader
        type="action"
        title="대상자 선택"
        description="미통과 대상자 또는 전체 학생에서 이번 클리닉에 참여할 학생을 선택하세요."
      />

      <ModalBody>
        <div
          className="clinic-target-select-modal__layout grid gap-4 min-h-0 overflow-hidden ds-split-layout"
        >
          {/* 좌측: 탭 + 검색 + 테이블 + 페이지네이션 */}
          <div className="flex flex-col gap-2 min-h-0 overflow-hidden">
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                className={`ds-choice-btn ds-choice-btn--primary flex-1 ${mode === "targets" ? "is-selected" : ""}`}
                onClick={() => switchMode("targets")}
                aria-pressed={mode === "targets"}
              >
                미통과 대상자
              </button>
              <button
                type="button"
                className={`ds-choice-btn ds-choice-btn--primary flex-1 ${mode === "students" ? "is-selected" : ""}`}
                onClick={() => switchMode("students")}
                aria-pressed={mode === "students"}
              >
                전체 학생
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 shrink-0">
              <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                {mode === "targets" ? "미통과 대상자 명단" : "전체 학생 명단"}
              </span>
              {selectedIds.length > 0 && (
                <span className="text-[13px] font-semibold text-[var(--color-brand-primary)]">
                  {selectedIds.length}명 선택됨
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_140px]">
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={mode === "students" ? "이름 / 전화번호 / 학교명 / 학년(예: 고1, 중2)" : "대상자 내 검색"}
                allowClear
                className="ds-input w-full text-sm shrink-0"
                aria-label={mode === "students" ? "학생 검색" : "대상자 검색"}
              />
              <select
                className="ds-input h-9 min-w-0 text-sm"
                value={nameOrdering}
                onChange={(event) => {
                  setNameOrdering(event.target.value as "name" | "-name");
                  setPage(1);
                }}
                aria-label="대상자 이름 정렬"
              >
                <option value="name">이름 가나다순</option>
                <option value="-name">이름 역순</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
              <span className="text-[13px] text-[var(--color-text-secondary)]">
                선택된 {selectedIds.length}명 / 전체 {totalCount}명
              </span>
              <div className="flex gap-2">
                {mode === "targets" && allTargetRows.length > rows.length && (
                  <Button
                    type="button"
                    intent="secondary"
                    size="sm"
                    onClick={selectAllTargets}
                    disabled={isLoading || isError || allTargetRows.length === 0}
                  >
                    대상자 {allTargetRows.length}명 모두 선택
                  </Button>
                )}
                <Button
                  type="button"
                  intent="secondary"
                  size="sm"
                  onClick={toggleAll}
                  disabled={isLoading || isError || rows.length === 0}
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
              className="clinic-target-select-modal__table-panel rounded-xl border overflow-hidden flex flex-col flex-1 min-h-0"
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
                ) : isError ? (
                  <EmptyState
                    mode="embedded"
                    scope="panel"
                    tone="error"
                    title="대상자 명단을 불러오지 못했습니다"
                    description="빈 명단으로 판단하지 않았습니다. 연결을 확인한 뒤 다시 시도해 주세요."
                    actions={(
                      <Button type="button" intent="secondary" size="sm" onClick={retryCurrentList}>
                        다시 시도
                      </Button>
                    )}
                  />
                ) : (
                  <table
                    className="clinic-target-select-modal__table w-full border-collapse"
                    role="grid"
                    aria-label={mode === "targets" ? "미통과 대상자 명단" : "전체 학생 명단"}
                  >
                    <colgroup>
                      <col width={TABLE_COL.checkbox} />
                      <col width={TABLE_COL.name} />
                      <col width={TABLE_COL.phoneCompact} />
                      <col width={TABLE_COL.phoneCompact} />
                      <col width={TABLE_COL.mediumModal} />
                      <col width={TABLE_COL.shortModal} />
                    </colgroup>
                    <thead>
                      <tr
                        className="clinic-target-select-modal__header-row sticky top-0 z-10"
                      >
                        <th className="clinic-target-select-modal__header-cell modal-inner-table__checkbox-cell border-b py-1.5 pl-2 pr-1 text-left text-[var(--color-text-muted)]">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            disabled={isLoading || isError || rows.length === 0}
                            onChange={toggleAll}
                            aria-label="현재 페이지 전체 선택"
                          />
                        </th>
                        <th className="clinic-target-select-modal__header-cell modal-inner-table__name-th border-b py-1.5 px-3 text-left text-[var(--color-text-muted)]">이름</th>
                        <th className="clinic-target-select-modal__header-cell border-b py-1.5 px-3 text-left text-[var(--color-text-muted)]">부모님 전화</th>
                        <th className="clinic-target-select-modal__header-cell border-b py-1.5 px-3 text-left text-[var(--color-text-muted)]">학생 전화</th>
                        <th className="clinic-target-select-modal__header-cell border-b py-1.5 px-3 text-left text-[var(--color-text-muted)]">학교</th>
                        <th className="clinic-target-select-modal__header-cell border-b py-1.5 px-3 text-left text-[var(--color-text-muted)]">학년</th>
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
                              className={`clinic-target-select-modal__row border-b ${checked ? "bg-[var(--color-bg-surface-soft)]" : ""}`}
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
                                {r.studentId != null && r.studentId > 0 ? (
                                  <button
                                    type="button"
                                    className="clinic-target-select-modal__student-detail"
                                    onClick={() => setDetailStudentId(r.studentId)}
                                    aria-label={`${r.name} 학생 상세 열기`}
                                  >
                                    <StudentNameWithLectureChip
                                      name={r.name || "(이름 없음)"}
                                      profilePhotoUrl={r.profilePhotoUrl}
                                      avatarSize={20}
                                      lectures={r.lectures}
                                      chipSize={14}
                                      clinicHighlight={r.clinicHighlight}
                                      density="compact"
                                    />
                                  </button>
                                ) : (
                                  <StudentNameWithLectureChip
                                    name={r.name || "(이름 없음)"}
                                    profilePhotoUrl={r.profilePhotoUrl}
                                    avatarSize={20}
                                    lectures={r.lectures}
                                    chipSize={14}
                                    clinicHighlight={r.clinicHighlight}
                                    density="compact"
                                  />
                                )}
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
                  className="clinic-target-select-modal__pagination flex items-center justify-between gap-3 py-2 px-3 border-t shrink-0"
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
            className="clinic-target-select-modal__selected-panel flex flex-col gap-4 rounded-xl border p-4 w-[220px] shrink-0 self-stretch min-h-0 overflow-hidden"
          >
            <section className="flex flex-col min-h-0 flex-1 overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 mb-2 shrink-0 pl-0.5">
                <span
                  className="clinic-target-select-modal__selected-count text-[13px] font-semibold"
                  data-selected={selectedIds.length > 0 ? "true" : "false"}
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
                className="clinic-target-select-modal__selected-list min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-lg border p-2"
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
              disabled={isLoading || isError || selectedIds.length === 0}
            >
              선택 확정 ({selectedIds.length}명)
            </Button>
          </>
        }
      />
    </AdminModal>
    {detailStudentId != null && createPortal(
        <StudentsDetailOverlay
          studentId={detailStudentId}
          onClose={() => setDetailStudentId(null)}
          layer="modal"
        />,
        document.body,
    )}
    </>
  );
}
