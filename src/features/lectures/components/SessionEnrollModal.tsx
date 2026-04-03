// PATH: src/features/lectures/components/SessionEnrollModal.tsx
// 차시(세션) 수강생 등록 — 기존 학생 추가(전체 명단 테이블) | 신규 학생 추가(학생추가모달)

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dropdown } from "antd";
import { fetchSessionEnrollments, lectureEnrollFromExcelUpload } from "../api/enrollments";
import type { SessionEnrollmentRow } from "../api/enrollments";
import { fetchSessions } from "../api/sessions";
import { bulkCreateAttendance, updateAttendance, fetchAttendanceEnrolledStudentIds } from "../api/attendance";
import { fetchStudents } from "@/features/students/api/students";
import type { ClientStudent } from "@/features/students/api/students";
import StudentCreateModal from "@/features/students/components/StudentCreateModal";
import StudentsDetailOverlay from "@/features/students/overlays/StudentsDetailOverlay";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import ExcelUploadZone from "@/shared/ui/excel/ExcelUploadZone";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button, EmptyState, Tabs } from "@/shared/ui/ds";
import { TABLE_COL } from "@/shared/ui/domain";
import { formatPhone } from "@/shared/utils/formatPhone";
import { feedback } from "@/shared/ui/feedback/feedback";
import { asyncStatusStore } from "@/shared/ui/asyncStatus";
import { useSchoolLevelMode } from "@/shared/hooks/useSchoolLevelMode";

const PAGE_SIZE = 100;
/** 탭 디자인 유지. '신규 학생 추가' 클릭 시 탭 전환 없이 학생추가 모달만 연다 */
const ENROLL_TABS = [
  { key: "existing", label: "기존 학생 추가" },
  { key: "new", label: "신규 학생 추가" },
];


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
  const [activeTab, setActiveTab] = useState("existing");
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
  const [excelInitialPassword, setExcelInitialPassword] = useState("");
  const [copyFromPrevLoading, setCopyFromPrevLoading] = useState(false);

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
    staleTime: 0,
  });

  const { data: sessionEnrollments = [] } = useQuery({
    queryKey: ["session-enrollments", sessionId],
    queryFn: () => fetchSessionEnrollments(sessionId),
    enabled: isOpen && Number.isFinite(sessionId),
    staleTime: 0,
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
    enabled: isOpen && activeTab === "existing",
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
    onError: (e: any) => {
      feedback.error(e?.response?.data?.detail ?? "수강생 추가에 실패했습니다.");
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
        .map((se) => ({ id: se.student_id, name: se.student_name ?? "-" }));
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
      return [...prev, { id, name, profilePhotoUrl, enrollments }];
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
      feedback.success("작업이 백그라운드에서 진행됩니다. 우하단에서 진행 상황을 확인할 수 있습니다.");
      onSuccess?.();
      onClose();
      setExcelPendingFile(null);
      setExcelInitialPassword("");
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
      if (e.key === "Enter" && !isTextarea && idsToAdd.length > 0 && !addByStudentMutation.isPending && !copyFromPrevLoading) {
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
              maxHeight: "min(78vh, 600px)",
              minHeight: activeTab === "existing" ? 480 : undefined,
            }}
          >
            {/* 좌측: 탭 + 필터바 + 테이블 */}
            <div className="flex flex-col gap-2 min-h-0 overflow-hidden">
              <div className="modal-tabs-elevated">
                <Tabs
                  value={activeTab}
                  items={ENROLL_TABS}
                  onChange={(key) => {
                    if (key === "new") setStudentCreateOpen(true);
                    else setActiveTab(key);
                  }}
                />
              </div>

              {activeTab === "existing" && (
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
                      </div>
                    );
                  })()}

                  <div
                    className="rounded-xl border overflow-hidden flex flex-col"
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
                                  검색 결과 없음. 검색어·필터를 바꿔 보세요.
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
                        <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                          총 {studentsToShow.length}명
                        </span>
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
              )}
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
                <div className="py-0.5">
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      intent="primary"
                      size="sm"
                      className="w-full font-semibold flex-1 min-w-0"
                      disabled={!prevSession || copyFromPrevLoading}
                      onClick={() => prevSession && handleCopyFromPrevToSelection()}
                      title={prevSession ? `직전 차시(${prevSession.order ?? "?"}차시) 수강생을 선택 목록에만 넣습니다.` : undefined}
                      aria-label={prevSession ? `직전 차시 ${prevSession.order ?? "?"}차시 수강생 선택 목록에 추가` : "직전 차시에서 (1차시는 해당 없음)"}
                    >
                      {copyFromPrevLoading
                        ? "직전 차시에서 가져오는 중…"
                        : prevSession
                          ? `직전 차시(${prevSession.order ?? "?"}차시)에서 불러오기`
                          : "직전 차시에서 불러오기"}
                    </Button>
                    <span
                      className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] cursor-help"
                      title="직전 차시에 등록된 수강생을 한 번에 불러올 수 있습니다."
                      aria-label="도움말: 직전 차시에 등록된 수강생을 한 번에 불러올 수 있습니다."
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <path d="M12 17h.01" />
                      </svg>
                    </span>
                  </div>
                </div>
                {excelPendingFile ? (
                  <div className="excel-upload-zone excel-upload-zone--filled flex flex-col items-stretch justify-center gap-3 py-4 px-3">
                    <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate text-center" title={excelPendingFile.name}>
                      {excelPendingFile.name}
                    </p>
                    <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">초기 비밀번호</label>
                    <input
                      type="password"
                      value={excelInitialPassword}
                      onChange={(e) => setExcelInitialPassword(e.target.value)}
                      placeholder="4자 이상"
                      className="ds-input w-full text-[13px]"
                      minLength={4}
                      aria-label="초기 비밀번호"
                    />
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
                  className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-lg border p-2 max-h-[310px]"
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
                          className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-[var(--color-bg-surface)] group min-h-[32px]"
                        >
                          <span className="flex items-center gap-2 min-w-0 flex-1 truncate">
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
                              className="text-[13px] font-semibold leading-6 text-[var(--color-text-primary)]"
                              clinicHighlight={(s as any).name_highlight_clinic_target === true}
                            />
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
