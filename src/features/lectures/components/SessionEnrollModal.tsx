// PATH: src/features/lectures/components/SessionEnrollModal.tsx
// 차시(세션) 수강생 등록 — 기존 학생 추가(전체 명단 테이블) | 신규 학생 추가(학생추가모달)

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSessionEnrollments,
  bulkCreateSessionEnrollments,
} from "../api/enrollments";
import { fetchSessions } from "../api/sessions";
import { bulkCreateAttendance } from "../api/attendance";
import { fetchStudents } from "@/features/students/api/students";
import type { ClientStudent } from "@/features/students/api/students";
import StudentCreateModal from "@/features/students/components/StudentCreateModal";
import StudentsDetailOverlay from "@/features/students/overlays/StudentsDetailOverlay";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button, EmptyState, Tabs } from "@/shared/ui/ds";
import { formatPhone } from "@/shared/utils/formatPhone";
import { feedback } from "@/shared/ui/feedback/feedback";

const PAGE_SIZE = 10;
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

interface Props {
  lectureId: number;
  sessionId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type SelectedItem = { id: number; name: string };

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
  });

  const students = studentsData?.data ?? [];
  const totalCount = studentsData?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

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
    mutationFn: (studentIds: number[]) => bulkCreateAttendance(sessionId, studentIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-enrollments", sessionId] });
      qc.invalidateQueries({ queryKey: ["attendance", sessionId] });
      qc.invalidateQueries({ queryKey: ["attendance-matrix", lectureId] });
      qc.invalidateQueries({ queryKey: ["lecture-enrollments", lectureId] });
      onSuccess?.();
      onClose();
      setSelectedItems([]);
    },
  });

  const copyFromPrevMutation = useMutation({
    mutationFn: async () => {
      if (!prevSession) throw new Error("직전 차시가 없습니다.");
      const prevList = await fetchSessionEnrollments(prevSession.id);
      const toAdd = prevList
        .map((se) => se.enrollment)
        .filter((eid) => !alreadyEnrolledIds.has(eid));
      if (toAdd.length === 0) return { added: 0 };
      await bulkCreateSessionEnrollments(sessionId, toAdd);
      return { added: toAdd.length };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["session-enrollments", sessionId] });
      qc.invalidateQueries({ queryKey: ["attendance", sessionId] });
      qc.invalidateQueries({ queryKey: ["attendance-matrix", lectureId] });
      onSuccess?.();
      if (result && "added" in result) {
        if (result.added > 0) {
          feedback.success(`직전 차시에서 ${result.added}명을 가져왔습니다.`);
          onClose();
        } else {
          feedback.info("가져올 새 수강생이 없습니다. (이미 모두 등록됨)");
        }
      }
    },
    onError: (e) => {
      feedback.error(e instanceof Error ? e.message : "가져오기 실패");
    },
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (selectedItems.length > 0 && activeTab === "existing" && !addByStudentMutation.isPending) {
          addByStudentMutation.mutate(selectedItems.map((s) => s.id));
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, selectedItems, activeTab, addByStudentMutation]);

  if (!isOpen) return null;

  const selectedIds = useMemo(() => new Set(selectedItems.map((s) => s.id)), [selectedItems]);

  const toggleSelect = (student: ClientStudent) => {
    const id = student.id;
    const name = student.name ?? "-";
    setSelectedItems((prev) => {
      if (prev.some((s) => s.id === id)) return prev.filter((s) => s.id !== id);
      return [...prev, { id, name }];
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
      setSelectedItems(all.map((s) => ({ id: s.id, name: s.name ?? "-" })));
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

  const handleExcelFile = () => {
    feedback.info("엑셀에서 불러오기 기능은 준비 중입니다.");
  };

  return (
    <>
      <AdminModal open={true} onClose={onClose} type="action" width={920}>
        <ModalHeader
          type="action"
          title="차시 수강생 등록"
          description="기존 학생을 선택해 추가하거나, 신규 학생을 등록한 뒤 차시에 포함할 수 있습니다."
        />

        <ModalBody>
          <div
            className="grid gap-4 min-h-0 overflow-hidden"
            style={{
              gridTemplateColumns: "1fr 280px",
              maxHeight: "min(78vh, 620px)",
            }}
          >
            {/* 좌측: 탭 + 테이블 (스크롤 없음, 페이지네이션만) */}
            <div className="flex flex-col gap-3 min-h-0 overflow-hidden">
              <Tabs
                value={activeTab}
                items={ENROLL_TABS}
                onChange={(key) => setActiveTab(key)}
              />

              {activeTab === "existing" && (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-semibold text-[var(--color-text-primary)]">
                      전체 학생 명단
                    </span>
                    {selectedItems.length > 0 && (
                      <span className="text-base font-medium text-[var(--color-brand-primary)]">
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
                    <div className="shrink-0">
                      {loadingStudents ? (
                        <EmptyState
                          mode="embedded"
                          scope="panel"
                          tone="loading"
                          title="불러오는 중…"
                        />
                      ) : (
                        <table
                          className="w-full border-collapse text-sm"
                          style={{ tableLayout: "fixed" }}
                          role="grid"
                          aria-label="전체 학생 명단"
                        >
                          <thead>
                            <tr
                              className="sticky top-0 z-10"
                              style={{ background: "var(--color-bg-surface)" }}
                            >
                              <th
                                className="w-10 border-b py-2.5 pl-3 pr-1 text-left text-sm font-semibold text-[var(--color-text-muted)]"
                                style={{ borderColor: "var(--color-border-divider)" }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isAllSelected}
                                  disabled={selectingAll || loadingStudents}
                                  onChange={() => toggleSelectAllFull()}
                                  className="cursor-pointer w-4 h-4"
                                  aria-label="전체 선택 (검색·필터 결과 전체)"
                                  title={isAllSelected ? "선택 해제" : "검색·필터 결과 전체 선택"}
                                />
                              </th>
                              <th
                                className="border-b py-2.5 px-3 text-left text-sm font-semibold text-[var(--color-text-muted)] cursor-pointer select-none hover:text-[var(--color-text-primary)]"
                                style={{ borderColor: "var(--color-border-divider)" }}
                                onClick={() => handleSort("name")}
                                aria-sort={sort === "name" ? "ascending" : sort === "-name" ? "descending" : "none"}
                              >
                                이름 {sortIcon("name")}
                              </th>
                              <th
                                className="border-b py-2.5 px-3 text-left text-sm font-semibold text-[var(--color-text-muted)] cursor-pointer select-none hover:text-[var(--color-text-primary)]"
                                style={{ borderColor: "var(--color-border-divider)" }}
                                onClick={() => handleSort("parentPhone")}
                                aria-sort={sort === "parentPhone" ? "ascending" : sort === "-parentPhone" ? "descending" : "none"}
                              >
                                부모님 전화 {sortIcon("parentPhone")}
                              </th>
                              <th
                                className="border-b py-2.5 px-3 text-left text-sm font-semibold text-[var(--color-text-muted)] cursor-pointer select-none hover:text-[var(--color-text-primary)]"
                                style={{ borderColor: "var(--color-border-divider)" }}
                                onClick={() => handleSort("studentPhone")}
                                aria-sort={sort === "studentPhone" ? "ascending" : sort === "-studentPhone" ? "descending" : "none"}
                              >
                                학생 전화 {sortIcon("studentPhone")}
                              </th>
                              <th
                                ref={schoolTriggerRef}
                                className="border-b py-2.5 px-3 text-left text-sm font-semibold text-[var(--color-text-muted)] cursor-pointer select-none hover:text-[var(--color-text-primary)] relative"
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
                                className="w-16 border-b py-2.5 px-3 text-left text-sm font-semibold text-[var(--color-text-muted)] cursor-pointer select-none hover:text-[var(--color-text-primary)] relative"
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
                            {students.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={6}
                                  className="py-8 px-3 text-center text-sm text-[var(--color-text-muted)]"
                                >
                                  검색 결과 없음. 검색어·필터를 바꿔 보세요.
                                </td>
                              </tr>
                            ) : (
                              students.map((row) => {
                                const checked = selectedIds.has(row.id);
                                const openStudentDetail = () => setOverlayStudentId(row.id);
                                return (
                                  <tr
                                    key={row.id}
                                    className={`border-b ${checked ? "bg-[var(--color-bg-surface-soft)]" : ""}`}
                                    style={{ borderColor: "var(--color-border-divider)" }}
                                  >
                                    <td
                                      className="py-2.5 pl-3 pr-1"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleSelect(row)}
                                        className="cursor-pointer w-4 h-4"
                                        aria-label={`${row.name} 선택`}
                                      />
                                    </td>
                                    <td
                                      className="py-2.5 px-3 font-medium text-[var(--color-text-primary)] truncate cursor-pointer hover:bg-[var(--color-bg-surface-soft)]"
                                      onClick={openStudentDetail}
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openStudentDetail(); } }}
                                    >
                                      <StudentNameWithLectureChip
                                        name={row.name ?? "-"}
                                        lectures={
                                          Array.isArray(row.enrollments) && row.enrollments.length > 0
                                            ? row.enrollments.slice(0, 5).map((en: { id: number; lectureName: string | null; lectureColor?: string | null }) => ({
                                                lectureName: en.lectureName ?? "??",
                                                color: en.lectureColor ?? undefined,
                                              }))
                                            : undefined
                                        }
                                        chipSize={16}
                                      />
                                    </td>
                                    <td
                                      className="py-2.5 px-3 text-[var(--color-text-secondary)] truncate cursor-pointer hover:bg-[var(--color-bg-surface-soft)]"
                                      onClick={openStudentDetail}
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openStudentDetail(); } }}
                                    >
                                      {formatPhone(row.parentPhone ?? "") || "미입력"}
                                    </td>
                                    <td
                                      className="py-2.5 px-3 text-[var(--color-text-secondary)] truncate cursor-pointer hover:bg-[var(--color-bg-surface-soft)]"
                                      onClick={openStudentDetail}
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openStudentDetail(); } }}
                                    >
                                      {formatPhone(row.studentPhone ?? "") || "미입력"}
                                    </td>
                                    <td
                                      className="py-2.5 px-3 text-[var(--color-text-secondary)] truncate cursor-pointer hover:bg-[var(--color-bg-surface-soft)]"
                                      title="학교 이름"
                                      onClick={openStudentDetail}
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openStudentDetail(); } }}
                                    >
                                      {row.school || "-"}
                                    </td>
                                    <td
                                      className="py-2.5 px-3 text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-bg-surface-soft)]"
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
                    {/* 페이지네이션: 항상 표시 (학생 데이터 있을 때), 1페이지여도 1/1 + 비활성 버튼 */}
                    {(students.length > 0 || totalCount > 0) && (
                      <div
                        className="flex items-center justify-between gap-2 py-2.5 px-3 border-t shrink-0 bg-[var(--color-bg-surface)]"
                        style={{ borderColor: "var(--color-border-divider)" }}
                      >
                        <span className="text-base font-medium text-[var(--color-text-primary)]">
                          총 {totalCount > 0 ? totalCount.toLocaleString() : students.length}명
                        </span>
                        <div className="flex items-center gap-0.5">
                          <Button
                            type="button"
                            intent="ghost"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage(1)}
                            aria-label="첫 페이지"
                            className="!min-w-9 !px-2 text-base"
                          >
                            ‹‹
                          </Button>
                          <Button
                            type="button"
                            intent="ghost"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            aria-label="이전 페이지"
                            className="!min-w-9 !px-2 text-base"
                          >
                            ‹
                          </Button>
                          <span className="text-base font-semibold text-[var(--color-text-primary)] px-2 min-w-[4rem] text-center">
                            {page} / {totalPages}
                          </span>
                          <Button
                            type="button"
                            intent="ghost"
                            size="sm"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            aria-label="다음 페이지"
                            className="!min-w-9 !px-2 text-base"
                          >
                            ›
                          </Button>
                          <Button
                            type="button"
                            intent="ghost"
                            size="sm"
                            disabled={page >= totalPages}
                            onClick={() => setPage(totalPages)}
                            aria-label="마지막 페이지"
                            className="!min-w-9 !px-2 text-base"
                          >
                            ››
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === "new" && (
                <div
                  className="flex flex-col items-center justify-center gap-4 rounded-xl border py-12 px-6"
                  style={{
                    borderColor: "var(--color-border-divider)",
                    background: "var(--color-bg-surface-soft)",
                    minHeight: 280,
                  }}
                >
                  <p className="text-sm text-[var(--color-text-secondary)] text-center">
                    신규 학생을 등록한 뒤, 이 차시 수강생 목록에서 선택해 추가할 수 있습니다.
                  </p>
                  <Button
                    type="button"
                    intent="primary"
                    size="md"
                    onClick={() => setStudentCreateOpen(true)}
                  >
                    학생 추가
                  </Button>
                </div>
              )}
            </div>

            {/* 우측: 불러오기 + 선택 목록 (모달 높이에 맞춤) */}
            <div
              className="flex flex-col gap-4 rounded-xl border p-4 shrink-0 min-h-0 overflow-hidden"
              style={{
                borderColor: "var(--color-border-divider)",
                background: "var(--color-bg-surface)",
              }}
            >
              <section className="shrink-0">
                <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
                  불러오기
                </h3>
                <div className="flex flex-col gap-2">
                  <div>
                    <Button
                      type="button"
                      intent="secondary"
                      size="sm"
                      className="w-full"
                      disabled={!prevSession || copyFromPrevMutation.isPending}
                      onClick={() => prevSession && copyFromPrevMutation.mutate()}
                      title={prevSession ? `직전 차시(${prevSession.order ?? "?"}차시) 수강생을 이 차시에 그대로 등록합니다.` : "1차시는 직전 차시가 없습니다."}
                      aria-label={prevSession ? `직전 차시 ${prevSession.order ?? "?"}차시 수강생 가져오기` : "직전 차시에서 (1차시는 해당 없음)"}
                    >
                      {copyFromPrevMutation.isPending
                        ? "가져오는 중…"
                        : prevSession
                          ? `직전 차시(${prevSession.order ?? "?"}차시)에서`
                          : "직전 차시에서"}
                    </Button>
                    {prevSession && (
                      <p className="mt-1.5 text-sm text-[var(--color-text-secondary)] leading-snug">
                        직전 차시 수강생을 이 차시에 그대로 등록합니다.
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    intent="secondary"
                    size="sm"
                    className="w-full text-base"
                    onClick={handleExcelFile}
                  >
                    엑셀에서
                  </Button>
                  <button
                    type="button"
                    onClick={handleExcelFile}
                    className="w-full text-center rounded-xl border-2 border-dashed py-4 px-3 transition-colors hover:border-[var(--color-brand-primary)] hover:bg-[color-mix(in_srgb,var(--color-brand-primary)_6%,transparent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
                    style={{ borderColor: "var(--color-border-divider)", background: "var(--color-bg-surface-soft)" }}
                  >
                    <span className="block text-[11px] text-[var(--color-text-muted)] mb-1" aria-hidden>엑셀 파일</span>
                    <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                      파일 선택 / 드래그
                    </span>
                    <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">(기능 준비 중)</span>
                  </button>
                </div>
              </section>

              {/* 선택된 학생 목록 — 모달 내 유일 스크롤 영역 */}
              <section className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between gap-2 mb-2 shrink-0 flex-wrap">
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                    선택된 학생 목록
                  </h3>
                  {selectedItems.length > 0 ? (
                    <span className="flex items-center gap-2">
                      <span className="text-base font-medium text-[var(--color-brand-primary)]">
                        {selectedItems.length}명 선택됨
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedItems([])}
                        className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] underline font-medium"
                        aria-label="선택 전체 해제"
                      >
                        전체 해제
                      </button>
                    </span>
                  ) : null}
                </div>
                <div
                  className="flex-1 min-h-[100px] overflow-y-auto overflow-x-hidden rounded-lg border p-2"
                  style={{
                    borderColor: "var(--color-border-divider)",
                    background: "var(--color-bg-surface-soft)",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  {selectedItems.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
                      선택한 학생이 없어요.
                      <span className="block mt-1.5 text-xs opacity-90">
                        왼쪽 테이블에서 체크 후 추가하세요.
                      </span>
                    </p>
                  ) : (
                    <ul className="space-y-0.5">
                      {selectedItems.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center justify-between gap-2 text-sm py-1.5 px-2 rounded hover:bg-[var(--color-bg-surface)] group"
                        >
                          <span className="truncate min-w-0 text-[var(--color-text-primary)]">
                            {s.name}
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
                {/* 이 차시에 이미 등록됨 — 우측 하단 (모달 인터페이스) */}
                <div className="mt-3 pt-3 border-t shrink-0 text-base font-semibold text-[var(--color-text-primary)]" style={{ borderColor: "var(--color-border-divider)" }}>
                  이 차시에 이미 등록됨: <span className="text-[var(--color-brand-primary)]">{sessionEnrollments.length}명</span>
                </div>
              </section>
            </div>
          </div>
        </ModalBody>

        <ModalFooter
          left={
            <span className="text-base font-medium text-[var(--color-text-primary)]">
              ESC 닫기 · ⌘/Ctrl + Enter 추가
            </span>
          }
          right={
            <>
              <Button intent="secondary" onClick={onClose} className="text-base">
                취소
              </Button>
              <Button
                intent="primary"
                className="text-base"
                onClick={() =>
                  addByStudentMutation.mutate(selectedItems.map((s) => s.id))
                }
                disabled={
                  addByStudentMutation.isPending ||
                  selectedItems.length === 0 ||
                  activeTab !== "existing"
                }
                title={
                  selectedItems.length === 0 && activeTab === "existing"
                    ? "왼쪽 테이블에서 학생을 선택하세요"
                    : undefined
                }
              >
                {addByStudentMutation.isPending
                  ? "등록 중…"
                  : `${selectedItems.length}명 추가`}
              </Button>
            </>
          }
        />
      </AdminModal>

      <StudentCreateModal
        open={studentCreateOpen}
        onClose={() => setStudentCreateOpen(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["session-enroll-modal-students"] });
          setStudentCreateOpen(false);
        }}
      />

    </>
  );
}
