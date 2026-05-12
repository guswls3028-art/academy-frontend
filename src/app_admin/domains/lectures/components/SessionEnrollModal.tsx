// PATH: src/app_admin/domains/lectures/components/SessionEnrollModal.tsx
// 차시(세션) 수강생 등록 — 기존 학생 추가(전체 명단 테이블) | 신규 학생 추가(학생추가모달)

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dropdown } from "antd";
import { fetchSessionEnrollments, fetchLectureEnrollments, lectureEnrollFromExcelUpload } from "../api/enrollments";
import type { SessionEnrollmentRow } from "../api/enrollments";
import { fetchSessions } from "../api/sessions";
import { bulkCreateAttendance, updateAttendance, fetchAttendanceEnrolledStudentIds } from "../api/attendance";
import { fetchStudents } from "@admin/domains/students/api/students.api";
import type { ClientStudent } from "@admin/domains/students/api/students.api";
import StudentCreateModal from "@admin/domains/students/components/StudentCreateModal";
import StudentsDetailOverlay from "@admin/domains/students/overlays/StudentsDetailOverlay";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import ExcelUploadZone from "@/shared/ui/excel/ExcelUploadZone";
import { downloadStudentExcelTemplate } from "@admin/domains/students/excel/studentExcel";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button, EmptyState } from "@/shared/ui/ds";
import { TABLE_COL } from "@/shared/ui/domain";
import { formatPhone } from "@/shared/utils/formatPhone";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import { asyncStatusStore } from "@/shared/ui/asyncStatus";
import { useSchoolLevelMode } from "@/shared/hooks/useSchoolLevelMode";
import { formatSessionOrderLabel } from "@/shared/ui/session-block";

const PAGE_SIZE = 100;


/** 정렬 옵션 (드롭다운용 단일 select) */
const SORT_SELECT_OPTIONS = [
  { value: "name", label: "이름순 (가나다)" },
  { value: "-name", label: "이름순 (가나다역)" },
  { value: "school", label: "학교순 (가나다)" },
  { value: "-school", label: "학교순 (가나다역)" },
  { value: "grade", label: "학년순 (낮은순)" },
  { value: "-grade", label: "학년순 (높은순)" },
  { value: "parentPhone", label: "부모전화순 (가나다)" },
  { value: "-parentPhone", label: "부모전화순 (가나다역)" },
] as const;

// ─── FilterDropdownContent (학생 도메인 필터 모달과 동일한 폼 디자인) ───────
type FilterDropdownContentProps = {
  sort: string;
  schoolType: string;
  grade: number;
  schoolOptions: { value: string; label: string }[];
  gradeOptions: { value: number; label: string }[];
  onSortChange: (key: string) => void;
  onSchoolTypeChange: (v: string) => void;
  onGradeChange: (v: number) => void;
  onReset: () => void;
};

function FilterDropdownContent({
  sort,
  schoolType,
  grade,
  schoolOptions,
  gradeOptions,
  onSortChange,
  onSchoolTypeChange,
  onGradeChange,
  onReset,
}: FilterDropdownContentProps) {
  const hasNonDefault = sort !== "name" || schoolType !== "" || grade !== 0;

  return (
    <div
      className="modal-scroll-body modal-scroll-body--compact"
      style={{ minWidth: 260, maxHeight: 320 }}
      data-app="admin"
    >
      <div className="modal-form-row modal-form-row--3">
        <select
          className="ds-select"
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          aria-label="정렬"
        >
          {SORT_SELECT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className="ds-select"
          value={schoolType}
          onChange={(e) => onSchoolTypeChange(e.target.value)}
          aria-label="구분"
        >
          {schoolOptions.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className="ds-select"
          value={grade}
          onChange={(e) => onGradeChange(Number(e.target.value))}
          aria-label="학년"
        >
          {gradeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {hasNonDefault && (
        <div className="modal-form-row modal-form-row--1-auto">
          <span className="modal-hint" style={{ marginBottom: 0 }}>
            조건에 맞는 학생만 목록에 표시됩니다.
          </span>
          <Button intent="ghost" size="sm" onClick={onReset}>
            초기화
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────
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

const PAGINATION_ICON_SIZE = 22;
function FirstPageIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden width={PAGINATION_ICON_SIZE} height={PAGINATION_ICON_SIZE}>
      <path d="M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6zM6 6h2v12H6z" />
    </svg>
  );
}
function PrevPageIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden width={PAGINATION_ICON_SIZE} height={PAGINATION_ICON_SIZE}>
      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
    </svg>
  );
}
function NextPageIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden width={PAGINATION_ICON_SIZE} height={PAGINATION_ICON_SIZE}>
      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
    </svg>
  );
}
function LastPageIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden width={PAGINATION_ICON_SIZE} height={PAGINATION_ICON_SIZE}>
      <path d="M5.59 7.41L10.18 12l-4.59 4.59L7 18l6-6-6-6zM18 6v12h-2V6z" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  lectureId: number;
  sessionId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type LectureChipInfo = { lectureName: string; color?: string | null; chipLabel?: string | null };
type SelectedItem = {
  id: number;
  name: string;
  displayName?: string;
  profilePhotoUrl?: string | null;
  enrollments?: LectureChipInfo[];
  /** 동명이인 식별용 — 우측 명단에 학교·학년 chip 표시. 직전 차시 불러오기 경로는 정보 없어 undefined (백로그) */
  school?: string | null;
  grade?: number | null;
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function SessionEnrollModal({
  lectureId,
  sessionId,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const qc = useQueryClient();
  const slm = useSchoolLevelMode();
  const [overlayStudentId, setOverlayStudentId] = useState<number | null>(null);
  // P2 (2026-05-13): "신규 학생 추가" 탭은 모달을 여는 함정 동작이라 탭 제거.
  // 명시적 "+ 새 학생 등록" 버튼으로 분리. 학원장이 클릭 결과를 예측 가능하도록.
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [studentCreateOpen, setStudentCreateOpen] = useState(false);
  const [sort, setSort] = useState("name");
  const [schoolType, setSchoolType] = useState("");  // "" | "HIGH" | "MIDDLE"
  const [grade, setGrade] = useState(0);             // 0=전체, 1, 2, 3
  const [excelUploading, setExcelUploading] = useState(false);
  const [excelStatusByStudentId, setExcelStatusByStudentId] = useState<Record<number, string>>({});
  const [excelPendingFile, setExcelPendingFile] = useState<File | null>(null);
  // 학원장이 한 번 확인하고 그대로 진행하는 흐름. 정책 자체는 4자 이상 유지.
  const [excelInitialPassword, setExcelInitialPassword] = useState("1234");
  const [copyFromPrevLoading, setCopyFromPrevLoading] = useState(false);
  const [copyFromLectureLoading, setCopyFromLectureLoading] = useState(false);

  // Dynamic school/grade options from school level mode
  const schoolOptions = useMemo(() => [
    { value: "", label: "전체" },
    ...slm.schoolTypes.map((st) => ({ value: st, label: slm.getLabel(st) })),
  ], [slm]);

  const gradeOptions = useMemo(() => {
    const grades = schoolType
      ? slm.gradeRange(schoolType as Parameters<typeof slm.gradeRange>[0])
      : Array.from(new Set(slm.schoolTypes.flatMap((st) => slm.gradeRange(st)))).sort((a, b) => a - b);
    return [
      { value: 0, label: "전체" },
      ...grades.map((g) => ({ value: g, label: `${g}학년` })),
    ];
  }, [slm, schoolType]);

  // Debounced search — 학년/구분 키워드 패턴을 필터로 자동 전환
  // 지원 패턴: "1학년"/"2~6학년", "고N"/"중N"/"초N"
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = keyword.trim();
      // "N학년" 패턴
      const gradeOnlyMatch = trimmed.match(/^([1-6])\s*학년?$/);
      // "고N" 패턴 (고등)
      const highMatch = trimmed.match(/^고\s*([1-3])$/);
      // "중N" 패턴 (중등)
      const midMatch = trimmed.match(/^중\s*([1-3])$/);
      // "초N" 패턴 (초등)
      const elemMatch = trimmed.match(/^초\s*([1-6])$/);

      if (gradeOnlyMatch) {
        setGrade(Number(gradeOnlyMatch[1]));
        setSearch("");
        setPage(1);
      } else if (highMatch) {
        setSchoolType("HIGH");
        setGrade(Number(highMatch[1]));
        setSearch("");
        setPage(1);
      } else if (midMatch) {
        setSchoolType("MIDDLE");
        setGrade(Number(midMatch[1]));
        setSearch("");
        setPage(1);
      } else if (elemMatch) {
        setSchoolType("ELEMENTARY");
        setGrade(Number(elemMatch[1]));
        setSearch("");
        setPage(1);
      } else {
        setSearch(trimmed);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [keyword]);

  // ── Queries ────────────────────────────────────────────────────────────────
  /** 출결(attendance) 기준 이미 등록된 학생 ID 전체 — 수강생 등록 모달에서 목록/등록 제외용. 엑셀 일괄업로드 멱등은 별도. */
  const { data: attendanceEnrolledIds = [] } = useQuery({
    queryKey: ["attendance-enrolled-ids", sessionId],
    queryFn: () => fetchAttendanceEnrolledStudentIds(sessionId),
    enabled: isOpen && Number.isFinite(sessionId),
    staleTime: 10_000, // 10초 — 모달 내 탭 전환 시 불필요한 refetch 방지
  });

  const { data: sessionEnrollments = [] } = useQuery({
    queryKey: ["session-enrollments", sessionId],
    queryFn: () => fetchSessionEnrollments(sessionId),
    enabled: isOpen && Number.isFinite(sessionId),
    staleTime: 10_000,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["lecture-sessions", lectureId],
    queryFn: () => fetchSessions(lectureId),
    enabled: isOpen && Number.isFinite(lectureId),
  });

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [sessions]
  );
  const prevSession = useMemo(() => {
    const idx = sortedSessions.findIndex((s) => s.id === sessionId);
    if (idx <= 0) return null;
    // 보강 세션은 건너뛰고 가장 가까운 정규 차시를 찾음
    for (let i = idx - 1; i >= 0; i--) {
      if (!(sortedSessions[i] as { title?: string }).title?.includes?.("보강")) return sortedSessions[i];
    }
    return sortedSessions[idx - 1]; // 전부 보강이면 직전 세션 사용
  }, [sortedSessions, sessionId]);

  const alreadyEnrolledIds = useMemo(
    () => new Set(sessionEnrollments.map((se) => se.enrollment)),
    [sessionEnrollments]
  );

  /** 이미 등록된 학생 ID 집합 — 출결(attendance) 목록 전체 기준. 표기/등록 모두에서 제외. */
  const alreadyEnrolledStudentIds = useMemo(
    () => new Set(attendanceEnrolledIds.filter((studentId) => Number.isFinite(studentId))),
    [attendanceEnrolledIds]
  );

  const apiFilters = useMemo(() => {
    const base: Record<string, unknown> = { page_size: PAGE_SIZE };
    if (schoolType !== "") base.school_type = schoolType;
    if (grade !== 0) base.grade = grade;
    return base;
  }, [schoolType, grade]);

  const { data: studentsData, isLoading: loadingStudents } = useQuery({
    queryKey: ["session-enroll-modal-students", search, apiFilters, sort, page],
    queryFn: () => fetchStudents(search, apiFilters, sort, page),
    enabled: isOpen,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const students = studentsData?.data ?? [];
  const totalCount = studentsData?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const studentsToShow = useMemo(
    () => students.filter((s) => !alreadyEnrolledStudentIds.has(s.id)),
    [students, alreadyEnrolledStudentIds]
  );

  /** 현재 페이지에서 이미 등록되어 숨겨진 학생 수 — 학원장 혼란("검색했는데 왜 안 보임?") 방지 안내용. */
  const hiddenAlreadyEnrolledInPage = useMemo(
    () => students.filter((s) => alreadyEnrolledStudentIds.has(s.id)).length,
    [students, alreadyEnrolledStudentIds]
  );

  // ── selectedIds — must be before early return (hooks rule) ─────────────────
  const selectedIds = useMemo(() => new Set(selectedItems.map((s) => s.id)), [selectedItems]);

  const idsToAdd = useMemo(
    () => selectedItems.map((s) => s.id).filter((studentId) => !alreadyEnrolledStudentIds.has(studentId)),
    [selectedItems, alreadyEnrolledStudentIds]
  );

  // ── Mutations ──────────────────────────────────────────────────────────────
  const addByStudentMutation = useMutation({
    mutationFn: async (payload: {
      studentIds: number[];
      statusByStudentId?: Record<number, string>;
    }) => {
      const created = await bulkCreateAttendance(sessionId, payload.studentIds);
      return { created: Array.isArray(created) ? created : created?.results ?? [], payload };
    },
    onSuccess: async (result) => {
      const { created, payload } = result;
      const { studentIds, statusByStudentId } = payload;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["session-enrollments", sessionId] }),
        qc.invalidateQueries({ queryKey: ["attendance", sessionId] }),
        qc.invalidateQueries({ queryKey: ["attendance-enrolled-ids", sessionId] }),
        qc.invalidateQueries({ queryKey: ["attendance-matrix", lectureId] }),
        qc.invalidateQueries({ queryKey: ["lecture-enrollments", lectureId] }),
      ]);
      if (statusByStudentId && created.length) {
        for (let i = 0; i < created.length; i++) {
          const studentId = studentIds[i];
          const status = statusByStudentId[studentId];
          if (status && created[i]?.id) {
            try {
              await updateAttendance(created[i].id, { status });
            } catch {
              // 개별 PATCH 실패 시 무시
            }
          }
        }
      }
      setExcelStatusByStudentId({});
      setSelectedItems([]);
      onSuccess?.();
      onClose();
    },
    onError: (e: unknown) => {
      feedback.error(extractApiError(e, "수강생 추가에 실패했습니다."));
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  /** 필터 드롭다운에서 정렬 선택 시 (값 그대로 설정) */
  const handleSortChange = useCallback((key: string) => {
    setSort(key);
    setPage(1);
  }, []);

  const handleSchoolTypeChange = useCallback((v: string) => {
    setSchoolType(v);
    setPage(1);
  }, []);

  const handleGradeChange = useCallback((v: number) => {
    setGrade(v);
    setPage(1);
  }, []);

  const handleFilterReset = useCallback(() => {
    setSort("name");
    setSchoolType("");
    setGrade(0);
    setPage(1);
  }, []);

  /** Column header sort toggle */
  const handleColSort = useCallback((colKey: string) => {
    setSort((prev) => {
      if (prev === colKey) return `-${colKey}`;
      if (prev === `-${colKey}`) return colKey;
      return colKey;
    });
    setPage(1);
  }, []);

  const sortIcon = useCallback((colKey: string) => {
    const isAsc = sort === colKey;
    const isDesc = sort === `-${colKey}`;
    const opacity = isAsc || isDesc ? 1 : 0.4;
    return (
      <span className="ml-0.5 text-[10px] text-[var(--color-text-muted)]" style={{ opacity }} aria-hidden>
        {isAsc ? "▲" : isDesc ? "▼" : "⇅"}
      </span>
    );
  }, [sort]);

  /**
   * 강의 수강생(ACTIVE)을 selectedItems에 시드.
   * 1차시 또는 새 강의 첫 등록 시 빠른 경로. 자동 X — 학원장이 버튼 누를 때만 동작.
   * 직전 차시 불러오기와 달리 "강의에 누적된 활성 학생 전원"이 대상이므로 학기 시작 시 자연.
   */
  const handleCopyFromLectureToSelection = useCallback(async () => {
    setCopyFromLectureLoading(true);
    try {
      const lectureList = await fetchLectureEnrollments(lectureId);
      // ACTIVE 만 시드 — 퇴원(INACTIVE)/대기(PENDING) 자동 제외
      const active = lectureList.filter((e: any) => e.status === "ACTIVE" || !e.status);
      // backend EnrollmentSerializer는 student 를 StudentShortSerializer 로 nested.
      // student.id / student.name / student.grade / student.high_school | middle_school | elementary_school
      const toAddRows = active.filter((e: any) => {
        const sid = e.student?.id;
        return sid != null && !alreadyEnrolledStudentIds.has(sid);
      });
      const itemsToAdd: SelectedItem[] = toAddRows.map((e: any) => {
        const s = e.student ?? {};
        const school = s.high_school || s.middle_school || s.elementary_school || null;
        return {
          id: s.id,
          name: s.name ?? "-",
          school,
          grade: s.grade ?? null,
        };
      });
      if (itemsToAdd.length === 0) {
        feedback.info("강의 수강생 중 추가할 학생이 없습니다. (이미 모두 등록되어 있거나 활성 학생이 없습니다)");
        return;
      }
      setSelectedItems((prev) => {
        const byId = new Map(prev.map((s) => [s.id, s]));
        itemsToAdd.forEach((item) => byId.set(item.id, item));
        return Array.from(byId.values());
      });
      feedback.success(`강의 수강생 ${itemsToAdd.length}명을 선택 목록에 추가했습니다. 아래에서 확인·편집 후 'N명 추가'로 등록하세요.`);
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : "강의 수강생 불러오기에 실패했습니다.");
    } finally {
      setCopyFromLectureLoading(false);
    }
  }, [lectureId, alreadyEnrolledStudentIds]);

  const handleCopyFromPrevToSelection = useCallback(async () => {
    if (!prevSession) return;
    setCopyFromPrevLoading(true);
    try {
      const prevList = await fetchSessionEnrollments(prevSession.id);
      const toAddRows = prevList.filter(
        (se) => !alreadyEnrolledIds.has(se.enrollment) && se.student_id != null && !alreadyEnrolledStudentIds.has(se.student_id)
      );
      const itemsToAdd: SelectedItem[] = toAddRows
        .filter((se): se is SessionEnrollmentRow & { student_id: number } => se.student_id != null)
        .map((se) => ({
          id: se.student_id,
          name: se.student_name ?? "-",
          school: se.student_school ?? null,
          grade: se.student_grade ?? null,
        }));
      if (itemsToAdd.length === 0) {
        feedback.info("가져올 새 수강생이 없습니다. (이미 모두 등록됨)");
        return;
      }
      setSelectedItems((prev) => {
        const byId = new Map(prev.map((s) => [s.id, s]));
        itemsToAdd.forEach((item) => byId.set(item.id, item));
        return Array.from(byId.values());
      });
      feedback.success(`직전 차시에서 ${itemsToAdd.length}명을 선택 목록에 추가했습니다. 아래에서 확인 후 'N명 추가'로 등록하세요.`);
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : "가져오기 실패");
    } finally {
      setCopyFromPrevLoading(false);
    }
  }, [prevSession, alreadyEnrolledIds, alreadyEnrolledStudentIds]);

  const toggleSelect = useCallback((student: ClientStudent) => {
    const id = student.id;
    const name = student.name ?? "-";
    const profilePhotoUrl = student.profilePhotoUrl ?? undefined;
    const enrollments: LectureChipInfo[] = Array.isArray(student.enrollments)
      ? student.enrollments.map((en) => ({
          lectureName: en.lectureName ?? "??",
          color: en.lectureColor ?? undefined,
          chipLabel: (en as { lectureChipLabel?: string | null }).lectureChipLabel ?? undefined,
        }))
      : [];
    setSelectedItems((prev) => {
      if (prev.some((s) => s.id === id)) return prev.filter((s) => s.id !== id);
      return [...prev, { id, name, profilePhotoUrl, enrollments, school: student.school ?? null, grade: student.grade ?? null }];
    });
  }, []);

  const removeSelected = useCallback((id: number) => {
    setSelectedItems((prev) => prev.filter((s) => s.id !== id));
  }, []);

  /** 현재 페이지(studentsToShow) 기준 전체 선택 여부 — DB 호출 없음 */
  const isCurrentPageAllSelected =
    studentsToShow.length > 0 &&
    studentsToShow.every((s) => selectedIds.has(s.id));

  /** 전체선택: 현재 페이지만 선택/해제. DB 안 때림. 실제 등록은 'N명 추가' 시에만. */
  const toggleSelectCurrentPage = useCallback(() => {
    if (isCurrentPageAllSelected) {
      setSelectedItems((prev) => {
        const pageIds = new Set(studentsToShow.map((s) => s.id));
        return prev.filter((s) => !pageIds.has(s.id));
      });
      return;
    }
    setSelectedItems((prev) => {
      const byId = new Map(prev.map((s) => [s.id, s]));
      studentsToShow.forEach((s) => {
        byId.set(s.id, {
          id: s.id,
          name: s.name ?? "-",
          profilePhotoUrl: s.profilePhotoUrl ?? undefined,
          enrollments: Array.isArray(s.enrollments)
            ? s.enrollments.map((en) => ({
                lectureName: en.lectureName ?? "??",
                color: en.lectureColor ?? undefined,
                chipLabel: (en as { lectureChipLabel?: string | null }).lectureChipLabel ?? undefined,
              }))
            : [],
          school: s.school ?? null,
          grade: s.grade ?? null,
        });
      });
      return Array.from(byId.values());
    });
  }, [isCurrentPageAllSelected, studentsToShow, selectedIds]);

  const handleExcelFileSelect = useCallback((file: File) => {
    if (excelUploading) return;
    setExcelPendingFile(file);
    setExcelInitialPassword("");
  }, [excelUploading]);

  const handleExcelEnrollSubmit = useCallback(async () => {
    if (!excelPendingFile || excelUploading) return;
    const pwd = excelInitialPassword.trim();
    if (pwd.length < 4) {
      feedback.error("초기 비밀번호는 4자 이상이어야 합니다. (신규 생성 학생 로그인용)");
      return;
    }
    setExcelUploading(true);
    try {
      const { job_id } = await lectureEnrollFromExcelUpload(lectureId, excelPendingFile, pwd, {
        sessionId,
      });
      if (!job_id) {
        feedback.error("작업 ID를 받지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      asyncStatusStore.addWorkerJob("엑셀 수강등록", job_id, "excel_parsing");
      feedback.success("작업이 백그라운드에서 진행됩니다. 우상단 작업박스에서 확인할 수 있습니다.");
      onSuccess?.();
      onClose();
      setExcelPendingFile(null);
      setExcelInitialPassword("1234");
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : "등록 요청 중 오류가 발생했습니다.");
    } finally {
      setExcelUploading(false);
    }
  }, [excelPendingFile, excelUploading, excelInitialPassword, lectureId, sessionId, onSuccess, onClose]);

  // ── Keyboard shortcut ──────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;
      if (e.key === "Escape") onClose();
      const isTextarea = (e.target as HTMLElement)?.tagName === "TEXTAREA";
      if (e.key === "Enter" && !isTextarea && idsToAdd.length > 0 && !addByStudentMutation.isPending && !copyFromPrevLoading && !copyFromLectureLoading) {
        e.preventDefault();
        addByStudentMutation.mutate({
          studentIds: idsToAdd,
          statusByStudentId: excelStatusByStudentId,
        });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, idsToAdd, excelStatusByStudentId, addByStudentMutation, onClose]);

  // ── Early return ───────────────────────────────────────────────────────────
  if (!isOpen) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <AdminModal open={true} onClose={onClose} type="action" width={840}>
        <ModalHeader
          type="action"
          title="차시 수강생 등록"
          description="기존 학생을 선택해 추가하거나, 신규 학생을 등록한 뒤 차시에 포함할 수 있습니다."
        />

        <ModalBody>
          <div
            className="grid gap-4 min-h-0 overflow-hidden ds-split-layout"
            style={{
              gridTemplateColumns: "1fr 220px",
              minHeight: 380,
            }}
          >
            {/* 좌측: 헤더 + 필터바 + 테이블 */}
            <div className="flex flex-col gap-2 min-h-0 overflow-hidden">
              {/* 학원장 안내 헤더 + 새 학생 등록 명시적 버튼 (구 "신규 학생 추가" 탭 함정 제거) */}
              <div className="flex items-center justify-between gap-3 pb-1">
                <div className="text-[12px] text-[var(--color-text-muted)]">
                  전체 학생 명단에서 선택하세요. 명단에 없는 학생은 오른쪽에서 새로 등록할 수 있어요.
                </div>
                <Button
                  type="button"
                  intent="secondary"
                  size="sm"
                  onClick={() => setStudentCreateOpen(true)}
                  className="shrink-0"
                >
                  + 새 학생 등록
                </Button>
              </div>

              <>
                  {/* 툴바 — 학생 도메인과 동일: 총계 | 검색+필터 */}
                  {(() => {
                    const activeFilterCount = [sort !== "name", schoolType !== "", grade !== 0].filter(Boolean).length;
                    // 이미 차시에 등록된 학생은 제외한 수(현재 페이지 기준)만 표시
                    const showCount = Array.isArray(studentsToShow) ? studentsToShow.length : 0;
                    return (
                      <div className="flex flex-col gap-3" style={{ marginBottom: 12 }}>
                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: "var(--color-text-primary)",
                              paddingRight: 12,
                              borderRight: "1px solid var(--color-border-divider)",
                              marginRight: 4,
                            }}
                          >
                            총 {showCount}명
                          </span>
                          <div className="flex items-center gap-2 flex-1 min-w-0" style={{ maxWidth: 420 }}>
                            <input
                              className="ds-input flex-1 min-w-0"
                              placeholder="이름 / 전화번호 / 학교명 / 학년(예: 고1, 중2, 3학년)"
                              value={keyword}
                              onChange={(e) => setKeyword(e.target.value)}
                              style={{ maxWidth: 360 }}
                              aria-label="이름 또는 전화번호로 검색"
                            />
                            <Dropdown
                              trigger={["click"]}
                              popupRender={() => (
                                <div
                                  className="rounded-xl border p-3 shadow-lg"
                                  style={{
                                    borderColor: "var(--color-border-divider)",
                                    background: "var(--color-bg-surface)",
                                    minWidth: 280,
                                  }}
                                >
                                  <FilterDropdownContent
                                    sort={sort}
                                    schoolType={schoolType}
                                    grade={grade}
                                    schoolOptions={schoolOptions}
                                    gradeOptions={gradeOptions}
                                    onSortChange={handleSortChange}
                                    onSchoolTypeChange={handleSchoolTypeChange}
                                    onGradeChange={handleGradeChange}
                                    onReset={handleFilterReset}
                                  />
                                </div>
                              )}
                            >
                              <span>
                                <Button intent="secondary">
                                  필터{activeFilterCount ? ` (${activeFilterCount})` : ""}
                                </Button>
                              </span>
                            </Dropdown>
                          </div>
                        </div>
                        {selectedItems.length > 0 && (
                          <span className="text-[13px] font-semibold text-[var(--color-brand-primary)]">
                            {selectedItems.length}명 선택됨
                          </span>
                        )}
                        {/* 빠른 불러오기 — 매주 가장 자주 누르는 액션. 좌측 상단 prominent CTA.
                            • 직전 차시 있음 (2차시~) → 직전 차시 불러오기 primary, 강의 수강생은 보조
                            • 직전 차시 없음 (1차시·새 강의) → 강의 수강생 가져오기 primary */}
                        <div
                          className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                          style={{
                            borderColor: "color-mix(in srgb, var(--color-brand-primary) 30%, var(--color-border-divider))",
                            background: "color-mix(in srgb, var(--color-brand-primary) 4%, var(--color-bg-surface))",
                          }}
                        >
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                              {prevSession ? "지난주 수강생을 한 번에 불러올 수 있어요" : "강의 수강생을 한 번에 불러올 수 있어요"}
                            </div>
                            <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)] leading-snug">
                              {prevSession ? (
                                <>직전 차시(<strong>{formatSessionOrderLabel(prevSession.order, prevSession.title)}</strong>) 수강생을 선택 목록에 추가합니다. 합류·퇴원자는 아래에서 편집 후 '추가'로 등록.</>
                              ) : (
                                <>이 강의의 활성 수강생 전원을 선택 목록에 추가합니다. 1차시·새 강의 시작에 추천. 아래에서 편집 후 '추가'로 등록.</>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-stretch gap-1 shrink-0">
                            {prevSession && (
                              <Button
                                type="button"
                                intent="primary"
                                size="sm"
                                disabled={copyFromPrevLoading || copyFromLectureLoading}
                                onClick={() => handleCopyFromPrevToSelection()}
                              >
                                {copyFromPrevLoading ? "불러오는 중…" : "직전 차시 불러오기"}
                              </Button>
                            )}
                            <Button
                              type="button"
                              intent={prevSession ? "secondary" : "primary"}
                              size="sm"
                              disabled={copyFromLectureLoading || copyFromPrevLoading}
                              onClick={() => handleCopyFromLectureToSelection()}
                              title="이 강의의 활성 수강생을 모두 선택 목록에 추가"
                            >
                              {copyFromLectureLoading ? "불러오는 중…" : "강의 수강생 가져오기"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div
                    className="rounded-xl border overflow-hidden flex flex-col flex-1 min-h-0"
                    style={{
                      borderColor: "var(--color-border-divider)",
                      background: "var(--color-bg-surface)",
                    }}
                  >
                    <div
                      className="modal-inner-table flex-1 min-h-0"
                      style={{ overflowY: "auto" }}
                    >
                      {loadingStudents ? (
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
                          aria-label="전체 학생 명단"
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
                              <th
                                className="modal-inner-table__checkbox-cell border-b py-1.5 pl-2 pr-1 text-left text-[var(--color-text-muted)]"
                                style={{ borderColor: "var(--color-border-divider)" }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isCurrentPageAllSelected}
                                  disabled={loadingStudents}
                                  onChange={() => toggleSelectCurrentPage()}
                                  aria-label="현재 페이지 전체 선택"
                                  title={isCurrentPageAllSelected ? "현재 페이지 선택 해제" : "현재 페이지 전체 선택"}
                                />
                              </th>
                              <th
                                className="modal-inner-table__name-th border-b py-1.5 px-3 text-left text-[var(--color-text-muted)] cursor-pointer select-none hover:text-[var(--color-text-primary)]"
                                style={{ borderColor: "var(--color-border-divider)" }}
                                onClick={() => handleColSort("name")}
                                aria-sort={sort === "name" ? "ascending" : sort === "-name" ? "descending" : "none"}
                              >
                                이름 {sortIcon("name")}
                              </th>
                              <th
                                className="border-b py-1.5 px-3 text-left text-[var(--color-text-muted)] cursor-pointer select-none hover:text-[var(--color-text-primary)]"
                                style={{ borderColor: "var(--color-border-divider)" }}
                                onClick={() => handleColSort("parentPhone")}
                                aria-sort={sort === "parentPhone" ? "ascending" : sort === "-parentPhone" ? "descending" : "none"}
                              >
                                부모님 전화 {sortIcon("parentPhone")}
                              </th>
                              <th
                                className="border-b py-1.5 px-3 text-left text-[var(--color-text-muted)] cursor-pointer select-none hover:text-[var(--color-text-primary)]"
                                style={{ borderColor: "var(--color-border-divider)" }}
                                onClick={() => handleColSort("studentPhone")}
                                aria-sort={sort === "studentPhone" ? "ascending" : sort === "-studentPhone" ? "descending" : "none"}
                              >
                                학생 전화 {sortIcon("studentPhone")}
                              </th>
                              <th
                                className="border-b py-1.5 px-3 text-left text-[var(--color-text-muted)] cursor-pointer select-none hover:text-[var(--color-text-primary)]"
                                style={{ borderColor: "var(--color-border-divider)" }}
                                onClick={() => handleColSort("school")}
                                aria-sort={sort === "school" ? "ascending" : sort === "-school" ? "descending" : "none"}
                                title="클릭하여 학교순 정렬"
                              >
                                학교 {sortIcon("school")}
                              </th>
                              <th
                                className="border-b py-1.5 px-3 text-left text-[var(--color-text-muted)] cursor-pointer select-none hover:text-[var(--color-text-primary)]"
                                style={{ borderColor: "var(--color-border-divider)" }}
                                onClick={() => handleColSort("grade")}
                                aria-sort={sort === "grade" ? "ascending" : sort === "-grade" ? "descending" : "none"}
                                title="클릭하여 학년순 정렬"
                              >
                                학년 {sortIcon("grade")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentsToShow.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={6}
                                  className="py-5 px-3 text-center text-[var(--color-text-muted)]"
                                >
                                  {hiddenAlreadyEnrolledInPage > 0
                                    ? `검색된 ${hiddenAlreadyEnrolledInPage}명은 이미 이 차시에 등록되어 표시되지 않습니다. 다른 학생을 검색하거나 차시 학생 목록에서 확인하세요.`
                                    : "검색 결과 없음. 검색어·필터를 바꿔 보세요."}
                                </td>
                              </tr>
                            ) : (
                              studentsToShow.map((row) => {
                                const checked = selectedIds.has(row.id);
                                const openStudentDetail = () => setOverlayStudentId(row.id);
                                return (
                                  <tr
                                    key={row.id}
                                    className={`border-b ${checked ? "bg-[var(--color-bg-surface-soft)]" : ""}`}
                                    style={{ borderColor: "var(--color-border-divider)" }}
                                  >
                                    <td
                                      className="modal-inner-table__checkbox-cell py-1.5 pl-2 pr-1"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleSelect(row)}
                                        aria-label={`${row.name} 선택`}
                                      />
                                    </td>
                                    <td
                                      className="modal-inner-table__name py-1.5 px-3 text-[var(--color-text-primary)] truncate cursor-pointer hover:bg-[var(--color-bg-surface-soft)]"
                                      onClick={openStudentDetail}
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openStudentDetail(); } }}
                                    >
                                      <StudentNameWithLectureChip
                                        name={row.displayName ?? row.name ?? "-"}
                                        profilePhotoUrl={row.profilePhotoUrl ?? undefined}
                                        avatarSize={20}
                                        lectures={
                                          Array.isArray(row.enrollments) && row.enrollments.length > 0
                                            ? row.enrollments.map((en: { id: number; lectureName: string | null; lectureColor?: string | null; lectureChipLabel?: string | null }) => ({
                                                lectureName: en.lectureName ?? "??",
                                                color: en.lectureColor ?? undefined,
                                                chipLabel: en.lectureChipLabel ?? undefined,
                                              }))
                                            : undefined
                                        }
                                        chipSize={14}
                                        clinicHighlight={(row as any).name_highlight_clinic_target === true}
                                      />
                                    </td>
                                    <td
                                      className="py-1.5 px-3 text-[var(--color-text-secondary)] truncate cursor-pointer hover:bg-[var(--color-bg-surface-soft)] leading-6"
                                      onClick={openStudentDetail}
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openStudentDetail(); } }}
                                    >
                                      {formatPhone(row.parentPhone ?? "") || "미입력"}
                                    </td>
                                    <td
                                      className="py-1.5 px-3 text-[var(--color-text-secondary)] truncate cursor-pointer hover:bg-[var(--color-bg-surface-soft)] leading-6"
                                      onClick={openStudentDetail}
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openStudentDetail(); } }}
                                    >
                                      {formatPhone(row.studentPhone ?? "") || "미입력"}
                                    </td>
                                    <td
                                      className="py-1.5 px-3 text-[var(--color-text-secondary)] truncate cursor-pointer hover:bg-[var(--color-bg-surface-soft)] leading-6"
                                      title="학교 이름"
                                      onClick={openStudentDetail}
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openStudentDetail(); } }}
                                    >
                                      {row.school || "-"}
                                    </td>
                                    <td
                                      className="py-1.5 px-3 text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-bg-surface-soft)] leading-6"
                                      onClick={openStudentDetail}
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openStudentDetail(); } }}
                                    >
                                      {row.grade != null ? `${row.grade}학년` : "-"}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {overlayStudentId != null &&
                      createPortal(
                        <StudentsDetailOverlay
                          studentId={overlayStudentId}
                          onClose={() => setOverlayStudentId(null)}
                        />,
                        document.body
                      )}

                    {/* 페이지네이션 */}
                    {(studentsToShow.length > 0 || students.length > 0) && (
                      <div
                        className="flex items-center justify-between gap-3 py-2.5 px-3 border-t shrink-0 bg-[var(--color-bg-surface)]"
                        style={{ borderColor: "var(--color-border-divider)" }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[13px] font-semibold text-[var(--color-text-primary)] shrink-0">
                            총 {studentsToShow.length}명
                          </span>
                          {hiddenAlreadyEnrolledInPage > 0 && studentsToShow.length > 0 && (
                            <span className="text-[11px] text-[var(--color-text-muted)] truncate">
                              · 이미 등록된 {hiddenAlreadyEnrolledInPage}명은 숨김
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            intent="ghost"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage(1)}
                            aria-label="첫 페이지"
                            className="!min-w-10 !h-10 !p-0 flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)] disabled:opacity-40"
                          >
                            <FirstPageIcon />
                          </Button>
                          <Button
                            type="button"
                            intent="ghost"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            aria-label="이전 페이지"
                            className="!min-w-10 !h-10 !p-0 flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)] disabled:opacity-40"
                          >
                            <PrevPageIcon />
                          </Button>
                          <span className="text-[13px] font-semibold text-[var(--color-text-primary)] px-3 min-w-[4.5rem] text-center">
                            {page} / {totalPages}
                          </span>
                          <Button
                            type="button"
                            intent="ghost"
                            size="sm"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            aria-label="다음 페이지"
                            className="!min-w-10 !h-10 !p-0 flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)] disabled:opacity-40"
                          >
                            <NextPageIcon />
                          </Button>
                          <Button
                            type="button"
                            intent="ghost"
                            size="sm"
                            disabled={page >= totalPages}
                            onClick={() => setPage(totalPages)}
                            aria-label="마지막 페이지"
                            className="!min-w-10 !h-10 !p-0 flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)] disabled:opacity-40"
                          >
                            <LastPageIcon />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
            </div>

            {/* 우측: 불러오기 + 선택 목록 */}
            <div
              className="flex flex-col gap-4 rounded-xl border p-4 w-[220px] shrink-0 self-stretch min-h-0 overflow-hidden"
              style={{
                borderColor: "var(--color-border-divider)",
                background: "var(--color-bg-surface)",
              }}
            >
              <section className="shrink-0 space-y-5">
                {/* 직전 차시 불러오기 — 좌측 상단 prominent CTA로 이동. 여기서는 엑셀만 노출. */}
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-semibold text-[var(--color-text-secondary)]">
                    엑셀로 일괄 등록
                  </label>
                  <button
                    type="button"
                    onClick={() => downloadStudentExcelTemplate(slm.mode)}
                    className="text-[11px] text-[var(--color-brand-primary)] hover:underline inline-flex items-center gap-1"
                    title="엑셀 양식 샘플 다운로드"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    샘플 양식
                  </button>
                </div>
                {excelPendingFile ? (
                  <div className="excel-upload-zone excel-upload-zone--filled flex flex-col items-stretch justify-center gap-3 py-4 px-3">
                    <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate text-center" title={excelPendingFile.name}>
                      {excelPendingFile.name}
                    </p>
                    <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">
                      신규 학생 초기 비밀번호
                    </label>
                    <input
                      type="text"
                      value={excelInitialPassword}
                      onChange={(e) => setExcelInitialPassword(e.target.value)}
                      placeholder="4자 이상"
                      className="ds-input w-full text-[13px]"
                      minLength={4}
                      autoComplete="off"
                      aria-label="신규 학생 초기 비밀번호"
                    />
                    <span className="text-[10.5px] text-[var(--color-text-muted)] leading-snug">
                      엑셀에 새로 만들 학생 로그인 비밀번호입니다. 기본값 그대로도 OK.
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        intent="primary"
                        size="sm"
                        onClick={handleExcelEnrollSubmit}
                        disabled={excelUploading || excelInitialPassword.trim().length < 4}
                      >
                        {excelUploading ? "등록 중…" : "엑셀로 일괄 등록"}
                      </Button>
                      <Button
                        type="button"
                        intent="secondary"
                        size="sm"
                        onClick={() => { setExcelPendingFile(null); setExcelInitialPassword(""); }}
                        disabled={excelUploading}
                      >
                        취소
                      </Button>
                    </div>
                  </div>
                ) : (
                  <ExcelUploadZone onFileSelect={handleExcelFileSelect} disabled={excelUploading} />
                )}
              </section>

              {/* N명 선택됨 · 선택 해제만 표시 */}
              <section className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 mb-2 shrink-0 pl-0.5">
                  <span
                    className="text-[13px] font-semibold"
                    style={{
                      color: selectedItems.length > 0 ? "var(--color-primary)" : "var(--color-text-muted)",
                    }}
                  >
                    {selectedItems.length}명 선택됨
                  </span>
                  <span className="text-[var(--color-border-divider)]" aria-hidden>|</span>
                  <Button
                    intent="secondary"
                    size="sm"
                    onClick={() => setSelectedItems([])}
                    disabled={selectedItems.length === 0}
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
                  {selectedItems.length === 0 ? (
                    <p className="text-[13px] text-[var(--color-text-muted)] py-4 text-center">
                      선택한 학생이 없어요.
                      <span className="block mt-1.5 text-[11px] text-[var(--color-text-muted)]">
                        왼쪽 테이블에서 체크 후 추가하세요.
                      </span>
                    </p>
                  ) : (
                    <ul className="space-y-0">
                      {selectedItems.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-[var(--color-bg-surface)] group min-h-[36px]"
                        >
                          <span className="flex flex-col min-w-0 flex-1 truncate">
                            <StudentNameWithLectureChip
                              name={s.displayName ?? s.name}
                              profilePhotoUrl={s.profilePhotoUrl}
                              avatarSize={20}
                              chipSize={14}
                              lectures={
                                Array.isArray(s.enrollments) && s.enrollments.length > 0
                                  ? s.enrollments.map((e) => ({
                                      lectureName: e.lectureName,
                                      color: e.color ?? undefined,
                                      chipLabel: e.chipLabel ?? undefined,
                                    }))
                                  : undefined
                              }
                              className="text-[13px] font-semibold leading-5 text-[var(--color-text-primary)]"
                              clinicHighlight={(s as any).name_highlight_clinic_target === true}
                            />
                            {(s.school || s.grade != null) && (
                              <span className="text-[10.5px] text-[var(--color-text-muted)] truncate ml-7 leading-tight">
                                {s.school || ""}{s.school && s.grade != null ? " · " : ""}{s.grade != null ? `${s.grade}학년` : ""}
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeSelected(s.id)}
                            className="shrink-0 p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] transition-colors"
                            aria-label={`${s.name} 선택 해제`}
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
                onClick={() =>
                  addByStudentMutation.mutate({
                    studentIds: idsToAdd,
                    statusByStudentId: excelStatusByStudentId,
                  })
                }
                disabled={addByStudentMutation.isPending || copyFromPrevLoading || idsToAdd.length === 0}
                title={copyFromPrevLoading ? "직전 차시 불러오기 진행 중…" : idsToAdd.length === 0 ? "왼쪽 테이블에서 학생을 선택하세요" : undefined}
              >
                {addByStudentMutation.isPending
                  ? "등록 중…"
                  : copyFromPrevLoading
                    ? "불러오는 중…"
                    : `${idsToAdd.length}명 추가`}
              </Button>
            </>
          }
        />
      </AdminModal>

      <StudentCreateModal
        open={studentCreateOpen}
        onClose={() => setStudentCreateOpen(false)}
        onSuccess={() => {
          setKeyword("");
          setSearch("");
          setPage(1);
          setSchoolType("");
          setGrade(0);
          qc.invalidateQueries({ queryKey: ["session-enroll-modal-students"] });
          setStudentCreateOpen(false);
        }}
      />
    </>
  );
}
