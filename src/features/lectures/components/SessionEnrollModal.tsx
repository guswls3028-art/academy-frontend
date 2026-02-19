// PATH: src/features/lectures/components/SessionEnrollModal.tsx
// 차시(세션) 수강생 등록 — 기존 학생 추가(전체 명단 테이블) | 신규 학생 추가(학생추가모달)

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSessionEnrollments, lectureEnrollFromExcelUpload } from "../api/enrollments";
import type { SessionEnrollmentRow } from "../api/enrollments";
import { fetchSessions } from "../api/sessions";
import { bulkCreateAttendance, updateAttendance } from "../api/attendance";
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

const PAGE_SIZE = 10;
/** 탭 디자인 유지. '신규 학생 추가' 클릭 시 탭 전환 없이 학생추가 모달만 연다 */
const ENROLL_TABS = [
  { key: "existing", label: "기존 학생 추가" },
  { key: "new", label: "신규 학생 추가" },
];

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
  profilePhotoUrl?: string | null;
  enrollments?: LectureChipInfo[];
};

export default function SessionEnrollModal({
  lectureId,
  sessionId,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const qc = useQueryClient();
  const [overlayStudentId, setOverlayStudentId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("existing");
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [studentCreateOpen, setStudentCreateOpen] = useState(false);
  const [sort, setSort] = useState("name");
  const [filters, setFilters] = useState<{ school_type?: string; grade?: number }>({});
  const [popover, setPopover] = useState<"school" | "grade" | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<{ left: number; top: number } | null>(null);
  const [selectingAll, setSelectingAll] = useState(false);
  const [excelUploading, setExcelUploading] = useState(false);
  /** 엑셀에서 파싱한 출결 값 (학생 ID → API status). 등록 후 PATCH에 사용 */
  const [excelStatusByStudentId, setExcelStatusByStudentId] = useState<Record<number, string>>({});
  /** 차시 엑셀 일괄등록: 선택된 파일 + 초기 비밀번호 (동일 워커 로직) */
  const [excelPendingFile, setExcelPendingFile] = useState<File | null>(null);
  const [excelInitialPassword, setExcelInitialPassword] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const schoolTriggerRef = useRef<HTMLTableCellElement>(null);
  const gradeTriggerRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(keyword.trim()), 300);
    return () => clearTimeout(t);
  }, [keyword]);

  useLayoutEffect(() => {
    if (popover === null) {
      setPopoverAnchor(null);
      return;
    }
    const el = popover === "school" ? schoolTriggerRef.current : gradeTriggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPopoverAnchor({ left: rect.left, top: rect.top });
  }, [popover]);

  useEffect(() => {
    if (popover === null) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (schoolTriggerRef.current?.contains(target) || gradeTriggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setPopover(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [popover]);

  const { data: sessionEnrollments = [] } = useQuery({
    queryKey: ["session-enrollments", sessionId],
    queryFn: () => fetchSessionEnrollments(sessionId),
    enabled: isOpen && Number.isFinite(sessionId),
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
    return sortedSessions[idx - 1];
  }, [sortedSessions, sessionId]);

  const alreadyEnrolledIds = useMemo(
    () => new Set(sessionEnrollments.map((se) => se.enrollment)),
    [sessionEnrollments]
  );

  /** 이미 해당 차시에 등록된 학생 ID — 목록에서 제외·선택 목록 중복 방지용 */
  const alreadyEnrolledStudentIds = useMemo(
    () =>
      new Set(
        sessionEnrollments
          .map((se) => se.student_id)
          .filter((id): id is number => id != null && Number.isFinite(id))
      ),
    [sessionEnrollments]
  );

  const apiFilters = useMemo(() => {
    const base: Record<string, unknown> = { page_size: PAGE_SIZE };
    if (filters.school_type != null && String(filters.school_type).trim() !== "") {
      base.school_type = filters.school_type;
    }
    if (filters.grade != null && Number.isInteger(filters.grade)) {
      base.grade = filters.grade;
    }
    return base;
  }, [filters]);

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

  /** 테이블에 표시할 학생만 (이미 해당 차시 등록된 학생 제외) */
  const studentsToShow = useMemo(
    () => students.filter((s) => !alreadyEnrolledStudentIds.has(s.id)),
    [students, alreadyEnrolledStudentIds]
  );

  /** 실제로 추가할 학생 ID만 (이미 등록된 학생 제외) */
  const idsToAdd = useMemo(
    () => selectedItems.map((s) => s.id).filter((id) => !alreadyEnrolledStudentIds.has(id)),
    [selectedItems, alreadyEnrolledStudentIds]
  );

  const handleSort = (colKey: string) => {
    setSort((prev) => {
      if (prev === colKey) return `-${colKey}`;
      if (prev === `-${colKey}`) return "";
      return colKey;
    });
    setPage(1);
  };

  const sortIcon = (colKey: string) => {
    const isAsc = sort === colKey;
    const isDesc = sort === `-${colKey}`;
    const opacity = isAsc || isDesc ? 1 : 0.4;
    return (
      <span className="ml-0.5 text-[10px] text-[var(--color-text-muted)]" style={{ opacity }} aria-hidden>
        {isAsc ? "▲" : isDesc ? "▼" : "⇅"}
      </span>
    );
  };

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
      qc.invalidateQueries({ queryKey: ["session-enrollments", sessionId] });
      qc.invalidateQueries({ queryKey: ["attendance", sessionId] });
      qc.invalidateQueries({ queryKey: ["attendance-matrix", lectureId] });
      qc.invalidateQueries({ queryKey: ["lecture-enrollments", lectureId] });
      if (statusByStudentId && created.length) {
        for (let i = 0; i < created.length; i++) {
          const studentId = studentIds[i];
          const status = statusByStudentId[studentId];
          if (status && created[i]?.id) {
            try {
              await updateAttendance(created[i].id, { status });
            } catch {
              // 개별 PATCH 실패 시 무시(목록은 이미 반영됨)
            }
          }
        }
      }
      setExcelStatusByStudentId({});
      setSelectedItems([]);
      onSuccess?.();
      onClose();
    },
  });

  const [copyFromPrevLoading, setCopyFromPrevLoading] = useState(false);

  const handleCopyFromPrevToSelection = async () => {
    if (!prevSession) return;
    setCopyFromPrevLoading(true);
    try {
      const prevList = await fetchSessionEnrollments(prevSession.id);
      const toAddRows = prevList.filter((se) => !alreadyEnrolledIds.has(se.enrollment));
      const itemsToAdd: SelectedItem[] = toAddRows
        .filter((se): se is SessionEnrollmentRow & { student_id: number } => se.student_id != null)
        .map((se) => ({ id: se.student_id, name: se.student_name ?? "-" })); /* 직전 차시는 id/name만 있음 */
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
  };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;
      if (e.key === "Escape") onClose();
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          if (idsToAdd.length > 0 && !addByStudentMutation.isPending) {
            addByStudentMutation.mutate({
            studentIds: idsToAdd,
            statusByStudentId: excelStatusByStudentId,
          });
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, idsToAdd, excelStatusByStudentId, addByStudentMutation]);

  if (!isOpen) return null;

  const selectedIds = useMemo(() => new Set(selectedItems.map((s) => s.id)), [selectedItems]);

  const toggleSelect = (student: ClientStudent) => {
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
  };

  const isAllSelected = totalCount > 0 && selectedItems.length === totalCount;

  const toggleSelectAllFull = async () => {
    if (isAllSelected) {
      setSelectedItems([]);
      return;
    }
    setSelectingAll(true);
    try {
      const all: ClientStudent[] = [];
      let p = 1;
      while (true) {
        const { data } = await fetchStudents(search, apiFilters, sort, p);
        if (!data?.length) break;
        all.push(...data);
        if (data.length < PAGE_SIZE) break;
        p += 1;
      }
      setSelectedItems(
        all
          .filter((s) => !alreadyEnrolledStudentIds.has(s.id))
          .map((s) => ({
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
          }))
      );
      if (all.length > 0) feedback.success(`전체 ${all.length}명 선택됨`);
    } catch (e) {
      feedback.error("전체 선택 중 오류가 났습니다.");
    } finally {
      setSelectingAll(false);
    }
  };

  const removeSelected = (id: number) => {
    setSelectedItems((prev) => prev.filter((s) => s.id !== id));
  };

  /** 엑셀 파일 선택 시 선택 목록에 넣지 않고, 동일 워커 로직(업로드→job)으로 보낼 파일만 저장 */
  const handleExcelFileSelect = (file: File) => {
    if (excelUploading) return;
    setExcelPendingFile(file);
    setExcelInitialPassword("");
  };

  /** 차시 엑셀 일괄등록 — 강의 엑셀 수강등록과 동일 API·워커 로직 (session_id만 추가) */
  const handleExcelEnrollSubmit = async () => {
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
      feedback.success(
        "작업이 백그라운드에서 진행됩니다. 우하단에서 진행 상황을 확인할 수 있습니다."
      );
      onSuccess?.();
      onClose();
      setExcelPendingFile(null);
      setExcelInitialPassword("");
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : "등록 요청 중 오류가 발생했습니다.");
    } finally {
      setExcelUploading(false);
    }
  };

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
            className="grid gap-4 min-h-0 overflow-hidden"
            style={{
              gridTemplateColumns: "1fr 220px",
              maxHeight: "min(78vh, 600px)",
              minHeight: activeTab === "existing" ? 480 : undefined,
            }}
          >
            {/* 좌측: 탭(신규 탭은 클릭 시 모달만 열림) + 테이블 */}
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
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                      전체 학생 명단
                    </span>
                    {selectedItems.length > 0 && (
                      <span className="text-[13px] font-semibold text-[var(--color-brand-primary)]">
                        {selectedItems.length}명 선택됨
                      </span>
                    )}
                  </div>
                  <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="검색어 입력 (이름·전화번호)"
                    className="ds-input w-full text-sm"
                    autoFocus
                    aria-label="이름 또는 전화번호로 검색"
                  />
                  <div
                    className="rounded-xl border overflow-hidden flex flex-col"
                    style={{
                      borderColor: "var(--color-border-divider)",
                      background: "var(--color-bg-surface)",
                    }}
                  >
                    <div className="shrink-0 modal-inner-table">
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
                                  checked={isAllSelected}
                                  disabled={selectingAll || loadingStudents}
                                  onChange={() => toggleSelectAllFull()}
                                  aria-label="전체 선택 (검색·필터 결과 전체)"
                                  title={isAllSelected ? "선택택 해제" : "검색·필터 결과 전체 선택"}
                                />
                              </th>
                              <th
                                className="modal-inner-table__name-th border-b py-1.5 px-3 text-left text-[var(--color-text-muted)] cursor-pointer select-none hover:text-[var(--color-text-primary)]"
                                style={{ borderColor: "var(--color-border-divider)" }}
                                onClick={() => handleSort("name")}
                                aria-sort={sort === "name" ? "ascending" : sort === "-name" ? "descending" : "none"}
                              >
                                이름 {sortIcon("name")}
                              </th>
                              <th
                                className="border-b py-1.5 px-3 text-left text-[var(--color-text-muted)] cursor-pointer select-none hover:text-[var(--color-text-primary)]"
                                style={{ borderColor: "var(--color-border-divider)" }}
                                onClick={() => handleSort("parentPhone")}
                                aria-sort={sort === "parentPhone" ? "ascending" : sort === "-parentPhone" ? "descending" : "none"}
                              >
                                부모님 전화 {sortIcon("parentPhone")}
                              </th>
                              <th
                                className="border-b py-1.5 px-3 text-left text-[var(--color-text-muted)] cursor-pointer select-none hover:text-[var(--color-text-primary)]"
                                style={{ borderColor: "var(--color-border-divider)" }}
                                onClick={() => handleSort("studentPhone")}
                                aria-sort={sort === "studentPhone" ? "ascending" : sort === "-studentPhone" ? "descending" : "none"}
                              >
                                학생 전화 {sortIcon("studentPhone")}
                              </th>
                              <th
                                ref={schoolTriggerRef}
                                className="border-b py-1.5 px-3 text-left text-[var(--color-text-muted)] cursor-pointer select-none hover:text-[var(--color-text-primary)] relative"
                                style={{ borderColor: "var(--color-border-divider)" }}
                                onClick={(e) => { e.stopPropagation(); setPopover((p) => (p === "school" ? null : "school")); }}
                                aria-haspopup="true"
                                aria-expanded={popover === "school"}
                                title="클릭 시 고등/중등 필터"
                              >
                                {filters.school_type === "HIGH" ? "고등학교" : filters.school_type === "MIDDLE" ? "중학교" : "학교 이름"}
                              </th>
                              <th
                                ref={gradeTriggerRef}
                                className="border-b py-1.5 px-3 text-left text-[var(--color-text-muted)] cursor-pointer select-none hover:text-[var(--color-text-primary)] relative"
                                style={{ borderColor: "var(--color-border-divider)" }}
                                onClick={(e) => { e.stopPropagation(); setPopover((p) => (p === "grade" ? null : "grade")); }}
                                aria-haspopup="true"
                                aria-expanded={popover === "grade"}
                              >
                                {filters.grade != null ? `${filters.grade}학년` : "학년"}
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
                                        name={row.name ?? "-"}
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
                    {popover !== null && popoverAnchor && createPortal(
                      <div
                        ref={popoverRef}
                        className="fixed flex items-center gap-2 rounded-lg border p-2 shadow-lg"
                        style={{
                          left: popoverAnchor.left,
                          top: popoverAnchor.top,
                          transform: "translateY(-100%)",
                          marginTop: -4,
                          zIndex: 9999,
                          background: "var(--color-bg-surface)",
                          borderColor: "var(--color-border-divider)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {popover === "school" &&
                          [
                            { value: "", label: "전체" },
                            { value: "HIGH", label: "고등학교" },
                            { value: "MIDDLE", label: "중학교" },
                          ].map((opt) => {
                            const selected = opt.value ? filters.school_type === opt.value : !filters.school_type;
                            return (
                              <Button
                                key={opt.value || "all"}
                                type="button"
                                intent={selected ? "primary" : "secondary"}
                                size="sm"
                                className="!min-w-[72px]"
                                onClick={() => {
                                  setFilters((f) => (opt.value ? { ...f, school_type: opt.value } : { ...f, school_type: undefined }));
                                  setPage(1);
                                  setPopover(null);
                                }}
                              >
                                {opt.label}
                              </Button>
                            );
                          })}
                        {popover === "grade" &&
                          [
                            { value: undefined, label: "전체" },
                            { value: 1, label: "1학년" },
                            { value: 2, label: "2학년" },
                            { value: 3, label: "3학년" },
                          ].map((opt) => {
                            const selected = opt.value != null ? filters.grade === opt.value : filters.grade == null;
                            return (
                              <Button
                                key={opt.value ?? "all"}
                                type="button"
                                intent={selected ? "primary" : "secondary"}
                                size="sm"
                                className="!min-w-[64px]"
                                onClick={() => {
                                  setFilters((f) => (opt.value != null ? { ...f, grade: opt.value } : { ...f, grade: undefined }));
                                  setPage(1);
                                  setPopover(null);
                                }}
                              >
                                {opt.label}
                              </Button>
                            );
                          })}
                      </div>,
                      document.body
                    )}
                    {/* 페이지네이션: 큼지막한 아이콘, 항상 표시 (학생 데이터 있을 때) */}
                    {(studentsToShow.length > 0 || totalCount > 0) && (
                      <div
                        className="flex items-center justify-between gap-3 py-2.5 px-3 border-t shrink-0 bg-[var(--color-bg-surface)]"
                        style={{ borderColor: "var(--color-border-divider)" }}
                      >
                        <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                          총 {totalCount > 0 ? totalCount.toLocaleString() : studentsToShow.length}명
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

            {/* 우측: 불러오기 + 선택 목록 (고정 높이, 모달 크기 불변) */}
            <div
              className="flex flex-col gap-4 rounded-xl border p-4 w-[220px] shrink-0 self-stretch min-h-0 overflow-hidden"
              style={{
                borderColor: "var(--color-border-divider)",
                background: "var(--color-bg-surface)",
              }}
            >
              <section className="shrink-0 space-y-5">
                <div className="py-0.5">
                  <Button
                    type="button"
                    intent="secondary"
                    size="sm"
                    className="w-full"
                  disabled={!prevSession || copyFromPrevLoading}
                  onClick={() => prevSession && handleCopyFromPrevToSelection()}
                  title={prevSession ? `직전 차시(${prevSession.order ?? "?"}차시) 수강생을 선택 목록에만 넣습니다.` : undefined}
                  aria-label={prevSession ? `직전 차시 ${prevSession.order ?? "?"}차시 수강생 선택 목록에 추가` : "직전 차시에서 (1차시는 해당 없음)"}
                >
                  {copyFromPrevLoading
                    ? "가져오는 중…"
                    : prevSession
                      ? `직전 차시(${prevSession.order ?? "?"}차시)에서 불러오기`
                      : "직전 차시에서 불러오기"}
                  </Button>
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
                            {Array.isArray(s.enrollments) && s.enrollments.length > 0 ? (
                              <StudentNameWithLectureChip
                                name={s.name}
                                profilePhotoUrl={s.profilePhotoUrl}
                                avatarSize={20}
                                chipSize={14}
                                lectures={s.enrollments.map((e) => ({
                                  lectureName: e.lectureName,
                                  color: e.color ?? undefined,
                                  chipLabel: e.chipLabel ?? undefined,
                                }))}
                                className="text-[13px] font-semibold leading-6 text-[var(--color-text-primary)]"
                              />
                            ) : (
                              <StudentNameWithLectureChip
                                name={s.name}
                                profilePhotoUrl={s.profilePhotoUrl}
                                avatarSize={20}
                                chipSize={14}
                                className="text-[13px] font-semibold leading-6 text-[var(--color-text-primary)]"
                              />
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
          left={
            <span className="text-[12px] font-semibold text-[var(--color-text-muted)]">
              ESC 닫기 · ⌘/Ctrl + Enter 추가
            </span>
          }
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
                disabled={addByStudentMutation.isPending || idsToAdd.length === 0}
                title={idsToAdd.length === 0 ? "왼쪽 테이블에서 학생을 선택하세요" : undefined}
              >
                {addByStudentMutation.isPending
                  ? "등록 중…"
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
          // 학생 추가 후 목록 새로고침: 검색어 초기화 + 첫 페이지로 이동하여 새 학생이 목록에 나타나도록 함
          setKeyword("");
          setSearch("");
          setPage(1);
          setFilters({});
          qc.invalidateQueries({ queryKey: ["session-enroll-modal-students"] });
          setStudentCreateOpen(false);
        }}
      />

    </>
  );
}
