// PATH: src/features/lectures/pages/attendance/SessionAttendancePage.tsx
// Design: students 도메인과 동일 — 검색·필터·컬럼정렬·툴바(수강생 등록만)
import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAttendance,
  updateAttendance,
  deleteAttendance,
  downloadAttendanceExcel,
  bulkSetPresent,
} from "@/features/lectures/api/attendance";
import api from "@/shared/api/axios";
import { EmptyState, Button } from "@/shared/ui/ds";
import { DomainListToolbar, DomainTable, STUDENTS_TABLE_COL, useTableColumnPrefs, ResizableTh } from "@/shared/ui/domain";
import type { TableColumnDef } from "@/shared/ui/domain";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import AttendanceStatusBadge, {
  ORDERED_ATTENDANCE_STATUS,
  type AttendanceStatus,
} from "@/shared/ui/badges/AttendanceStatusBadge";
import { formatPhone } from "@/shared/utils/formatPhone";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import { useSendMessageModal } from "@/features/messages/context/SendMessageModalContext";
import "./attendance-ui.css";

const STATUS_LIST = ORDERED_ATTENDANCE_STATUS;
const PAGE_SIZE = 50;

type SessionAttendancePageProps = {
  sessionId: number;
  lectureId?: number;
  onOpenEnrollModal?: () => void;
};

function matchSearch(att: any, q: string): boolean {
  if (!q.trim()) return true;
  const k = q.trim().toLowerCase();
  const digits = q.trim().replace(/\D/g, "");
  const name = (att.name ?? "").toLowerCase();
  const phone = (formatPhone(att.phone ?? att.student_phone ?? "") ?? "").replace(/\D/g, "");
  const parentPhone = (formatPhone(att.parent_phone ?? "") ?? "").replace(/\D/g, "");
  return name.includes(k) || (digits.length >= 2 && (phone.includes(digits) || parentPhone.includes(digits)));
}

export default function SessionAttendancePage({
  sessionId,
  lectureId,
  onOpenEnrollModal,
}: SessionAttendancePageProps) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { openSendMessageModal } = useSendMessageModal();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState("-name");
  const [page, setPage] = useState(1);
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const statusTriggerRef = useRef<HTMLButtonElement>(null);
  const statusPopoverRef = useRef<HTMLDivElement>(null);
  const [statusPopoverAnchor, setStatusPopoverAnchor] = useState<{ left: number; top: number } | null>(null);
  /** 상태 뱃지 클릭 시 테이블 외부 가로 팝오버로 표시. null이면 닫힘 */
  const [openStatusRowAttId, setOpenStatusRowAttId] = useState<number | null>(null);
  /** 팝오버 위치(트리거 버튼 기준). createPortal로 body에 그릴 때 사용 */
  const [statusRowPopoverAnchor, setStatusRowPopoverAnchor] = useState<{ left: number; top: number } | null>(null);
  const statusRowPopoverRef = useRef<HTMLDivElement>(null);
  const statusRowTriggerRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!statusPopoverOpen) {
      setStatusPopoverAnchor(null);
      return;
    }
    const el = statusTriggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setStatusPopoverAnchor({ left: rect.left, top: rect.top });
  }, [statusPopoverOpen]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    if (!statusPopoverOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (statusTriggerRef.current?.contains(target) || statusPopoverRef.current?.contains(target)) return;
      setStatusPopoverOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [statusPopoverOpen]);

  /** 출결 상태 행 팝오버: 바깥 클릭 시 닫기 */
  useEffect(() => {
    if (openStatusRowAttId == null) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (statusRowTriggerRef.current?.contains(target) || statusRowPopoverRef.current?.contains(target)) return;
      setOpenStatusRowAttId(null);
      setStatusRowPopoverAnchor(null);
      statusRowTriggerRef.current = null;
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [openStatusRowAttId]);

  const { data: attendanceResult, isLoading } = useQuery({
    queryKey: ["attendance", sessionId, page, search, statusFilter],
    queryFn: () =>
      fetchAttendance(sessionId, {
        page,
        page_size: PAGE_SIZE,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
      }),
    enabled: Number.isFinite(sessionId),
  });

  const pageData = attendanceResult?.data ?? [];
  const totalCount = attendanceResult?.count ?? 0;
  const pageSize = attendanceResult?.pageSize ?? PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const { data: lecture } = useQuery({
    queryKey: ["lecture", lectureId],
    queryFn: async () => (await api.get(`/lectures/lectures/${lectureId}/`)).data,
    enabled: Number.isFinite(lectureId ?? 0),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: AttendanceStatus }) =>
      updateAttendance(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", sessionId] });
      qc.invalidateQueries({ queryKey: ["session-scores"] });
    },
    onError: () => { feedback.error("출석 상태 변경에 실패했습니다. 다시 시도해 주세요."); },
  });

  const updateMemo = useMutation({
    mutationFn: ({ id, memo }: { id: number; memo: string }) =>
      updateAttendance(id, { memo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance", sessionId] }),
    onError: () => { feedback.error("메모 저장에 실패했습니다."); },
  });

  const filtered = useMemo(() => pageData, [pageData]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const key = sort.startsWith("-") ? sort.slice(1) : sort;
    const asc = !sort.startsWith("-");
    list.sort((a: any, b: any) => {
      if (key === "name") {
        const va = (a.name ?? "").localeCompare(b.name ?? "", "ko");
        return asc ? va : -va;
      }
      if (key === "status") {
        const order = ORDERED_ATTENDANCE_STATUS.indexOf(a.status) - ORDERED_ATTENDANCE_STATUS.indexOf(b.status);
        return asc ? order : -order;
      }
      if (key === "phone") {
        const va = (formatPhone(a.phone ?? a.student_phone) ?? "").localeCompare(
          formatPhone(b.phone ?? b.student_phone) ?? ""
        );
        return asc ? va : -va;
      }
      if (key === "parent_phone") {
        const va = (formatPhone(a.parent_phone) ?? "").localeCompare(formatPhone(b.parent_phone) ?? "");
        return asc ? va : -va;
      }
      return 0;
    });
    return list;
  }, [filtered, sort]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const col = STUDENTS_TABLE_COL;
  const attendanceColumnDefs: TableColumnDef[] = useMemo(
    () => [
      { key: "checkbox", label: "선택", defaultWidth: col.checkbox, minWidth: 40, maxWidth: 120 },
      { key: "name", label: "이름", defaultWidth: col.name, minWidth: 80, maxWidth: 400 },
      { key: "status", label: "상태", defaultWidth: col.statusBadge, minWidth: 60, maxWidth: 140 },
      { key: "parent_phone", label: "학부모 전화번호", defaultWidth: col.parentPhone, minWidth: 90, maxWidth: 200 },
      { key: "phone", label: "학생 전화번호", defaultWidth: col.studentPhone, minWidth: 90, maxWidth: 200 },
      { key: "memo", label: "메모", defaultWidth: col.memo, minWidth: 140, maxWidth: 500 },
    ],
    []
  );
  const { columnWidths, setColumnWidth } = useTableColumnPrefs("session-attendance", attendanceColumnDefs);
  const tableWidth = useMemo(
    () => attendanceColumnDefs.reduce((sum, c) => sum + (columnWidths[c.key] ?? c.defaultWidth), 0),
    [attendanceColumnDefs, columnWidths]
  );

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (attendanceResult == null) return <EmptyState scope="panel" tone="error" title="출결 데이터를 불러올 수 없습니다." />;

  const allIds = sorted.map((att: any) => att.id);
  const allSelected = sorted.length > 0 && allIds.every((attendanceId: number) => selectedSet.has(attendanceId));

  function toggleSelect(id: number) {
    if (selectedSet.has(id)) setSelectedIds(selectedIds.filter((x) => x !== id));
    else setSelectedIds([...selectedIds, id]);
  }
  function toggleSelectAll() {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds([...allIds]);
  }

  const handleMessageSend = () => {
    if (selectedIds.length === 0) return;
    const selectedRows = sorted.filter((att: any) => selectedSet.has(att.id));
    const studentIds = selectedRows
      .map((att: any) => att.student_id)
      .filter((id: unknown) => id != null && Number.isFinite(id));
    openSendMessageModal({
      studentIds,
      recipientLabel: `선택한 출결 ${selectedIds.length}명`,
      blockCategory: "attendance",
    });
  };

  const handleExcelDownload = () => {
    if (lectureId != null && Number.isFinite(lectureId)) {
      downloadAttendanceExcel(lectureId);
    } else {
      feedback.info("엑셀 다운로드는 강의 단위로 제공됩니다.");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const ok = await confirm({
      title: "삭제 확인",
      message: `선택한 ${selectedIds.length}명을 이 차시 출결에서 제외하시겠습니까?\n(수강생 등록은 유지되며, 출결 기록만 제거됩니다.)`,
      danger: true,
      confirmText: "삭제",
    });
    if (!ok) return;
    const count = selectedIds.length;
    setDeleting(true);
    try {
      await Promise.all(selectedIds.map((attendanceId) => deleteAttendance(attendanceId)));
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: ["attendance", sessionId] });
      qc.invalidateQueries({ queryKey: ["session-enrollments", sessionId] });
      feedback.success(`${count}명 출결에서 제외되었습니다.`);
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  };

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
      <Button intent="secondary" size="sm" onClick={handleMessageSend} disabled={selectedIds.length === 0}>
        메시지 발송
      </Button>
      <Button intent="secondary" size="sm" onClick={handleExcelDownload}>
        엑셀 다운로드
      </Button>
      <Button
        intent="danger"
        size="sm"
        disabled={selectedIds.length === 0 || deleting}
        onClick={handleBulkDelete}
      >
        {deleting ? "삭제 중…" : "삭제"}
      </Button>
      </div>
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-1 pl-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              style={{
                minWidth: 32,
                height: 32,
                padding: "0 8px",
                fontSize: 13,
                fontWeight: page === p ? 700 : 500,
                borderRadius: 6,
                border: page === p ? "2px solid var(--color-primary)" : "1px solid var(--color-border-divider)",
                background: page === p ? "var(--state-selected-bg)" : "var(--color-bg-surface)",
                color: page === p ? "var(--color-primary)" : "var(--color-text-secondary)",
                cursor: "pointer",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const handleBulkSetPresent = async () => {
    const ok = await confirm({ title: "확인", message: "모든 학생의 출석 상태를 '현장'으로 설정합니다.", danger: false, confirmText: "확인" });
    if (!ok) return;
    try {
      const result = await bulkSetPresent(sessionId);
      qc.invalidateQueries({ queryKey: ["attendance", sessionId] });
      qc.invalidateQueries({ queryKey: ["attendance-matrix"] });
      qc.invalidateQueries({ queryKey: ["session-scores"] });
      feedback.success(result.updated > 0 ? `${result.updated}명 현장 출석으로 변경` : "이미 전원 현장 출석입니다.");
    } catch {
      feedback.error("일괄 출석 변경에 실패했습니다.");
    }
  };

  const primaryAction = (
    <div className="flex items-center gap-2">
      <Button type="button" intent="secondary" size="sm" onClick={handleBulkSetPresent}>
        전체 현장 출석
      </Button>
      {onOpenEnrollModal && (
        <Button type="button" intent="primary" size="sm" onClick={onOpenEnrollModal}>
          수강생 등록
        </Button>
      )}
    </div>
  );

  const filterSlot = (
    <>
      <span ref={statusTriggerRef}>
        <Button
          type="button"
          intent="secondary"
          size="sm"
          onClick={(e) => { e.stopPropagation(); setStatusPopoverOpen((v) => !v); }}
          aria-haspopup="true"
          aria-expanded={statusPopoverOpen}
          aria-label="출결 상태 필터"
        >
          {statusFilter ? (
            <span className="inline-flex items-center gap-1.5">
              <AttendanceStatusBadge status={statusFilter as AttendanceStatus} variant="2ch" />
            </span>
          ) : (
            "상태필터"
          )}
        </Button>
      </span>
      {statusPopoverOpen && statusPopoverAnchor &&
        createPortal(
          <div
            ref={statusPopoverRef}
            className="attendance-popover fixed flex flex-wrap items-center gap-2 rounded-lg border p-2 shadow-lg"
            style={{
              left: statusPopoverAnchor.left,
              top: statusPopoverAnchor.top,
              transform: "translateY(-100%)",
              marginTop: -4,
              zIndex: 9999,
              background: "var(--color-bg-surface)",
              borderColor: "var(--color-border-divider)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              type="button"
              intent={!statusFilter ? "primary" : "secondary"}
              size="sm"
              className="attendance-popover-item"
              onClick={() => { setStatusFilter(""); setStatusPopoverOpen(false); }}
            >
              전체
            </Button>
            {STATUS_LIST.map((code) => {
              const selected = statusFilter === code;
              return (
                <button
                  key={code}
                  type="button"
                  className="attendance-popover-item cursor-pointer rounded border-0 p-0.5 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]/40"
                  style={{
                    opacity: selected ? 1 : 0.85,
                    boxShadow: selected ? "0 0 0 2px var(--color-primary)" : undefined,
                  }}
                  onClick={() => { setStatusFilter(code); setStatusPopoverOpen(false); }}
                >
                  <AttendanceStatusBadge status={code} variant="2ch" />
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );

  function sortHeader(colKey: string, label: string) {
    const isAsc = sort === colKey;
    const isDesc = sort === `-${colKey}`;
    const next = isAsc ? `-${colKey}` : isDesc ? "" : colKey;
    const def = attendanceColumnDefs.find((c) => c.key === colKey);
    const w = columnWidths[colKey] ?? def?.defaultWidth ?? 100;
    return (
      <ResizableTh
        columnKey={colKey}
        width={w}
        minWidth={def?.minWidth ?? 40}
        maxWidth={def?.maxWidth ?? 500}
        onWidthChange={setColumnWidth}
        scope="col"
        onClick={() => setSort(next || "name")}
        className="cursor-pointer select-none"
        aria-sort={isAsc ? "ascending" : isDesc ? "descending" : "none"}
      >
        <span className="inline-flex items-center gap-2">
          {label}
          <span
            aria-hidden
            style={{ fontSize: 11, opacity: isAsc || isDesc ? 1 : 0.35, color: "var(--color-primary)" }}
          >
            {isAsc ? "▲" : isDesc ? "▼" : "⇅"}
          </span>
        </span>
      </ResizableTh>
    );
  }

  return (
    <div className="flex flex-col gap-4 relative">
      {/* 출결 상태 선택 팝오버: 테이블 외부, 가로 나열, 상태필터와 동일 스타일 */}
      {openStatusRowAttId != null && statusRowPopoverAnchor != null && (() => {
        const att = sorted.find((a: any) => a.id === openStatusRowAttId);
        if (!att) return null;
        return createPortal(
          <div
            ref={statusRowPopoverRef}
            className="attendance-popover fixed flex flex-wrap items-center gap-2 rounded-lg border p-2 shadow-lg z-[9999]"
            style={{
              left: statusRowPopoverAnchor.left,
              top: statusRowPopoverAnchor.top,
              transform: "translateY(-100%)",
              marginTop: -4,
              background: "var(--color-bg-surface)",
              borderColor: "var(--color-border-divider)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {STATUS_LIST.map((code) => {
              const active = att.status === code;
              return (
                <button
                  key={code}
                  type="button"
                  className="attendance-popover-item cursor-pointer rounded border-0 p-0.5 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-1"
                  style={{
                    opacity: active ? 1 : 0.85,
                    boxShadow: active ? "0 0 0 2px var(--color-primary)" : undefined,
                  }}
                  onClick={async () => {
                    if (active) {
                      setOpenStatusRowAttId(null);
                      setStatusRowPopoverAnchor(null);
                      statusRowTriggerRef.current = null;
                      return;
                    }
                    if (code === "SECESSION") {
                      const secOk = await confirm({
                        title: "확인",
                        message: `"${att.name}" 학생을 퇴원 처리하시겠습니까?\n\n• 수강등록이 비활성화됩니다\n• 시험/과제 응시 대상에서 제외됩니다\n• 기존 데이터(성적·출결)는 보관됩니다`,
                        danger: true,
                        confirmText: "확인",
                      });
                      if (!secOk) return;
                    }
                    updateStatus.mutate(
                      { id: att.id, status: code },
                      code === "SECESSION"
                        ? {
                            onSuccess: () => {
                              qc.invalidateQueries({ queryKey: ["attendance-matrix"] });
                              qc.invalidateQueries({ queryKey: ["session-enrollments"] });
                              feedback.success(`${att.name} 학생이 퇴원 처리되었습니다.`);
                            },
                          }
                        : undefined,
                    );
                    setOpenStatusRowAttId(null);
                    setStatusRowPopoverAnchor(null);
                    statusRowTriggerRef.current = null;
                  }}
                >
                  <AttendanceStatusBadge status={code} variant="2ch" />
                </button>
              );
            })}
          </div>,
          document.body
        );
      })()}
      <DomainListToolbar
        totalLabel={isLoading ? "…" : `총 ${totalCount}명`}
        searchSlot={
          <input
            className="ds-input"
            placeholder="이름 / 전화번호 검색"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ maxWidth: 280 }}
          />
        }
        filterSlot={filterSlot}
        primaryAction={primaryAction}
        belowSlot={selectionBar}
      />
      <div className="overflow-x-auto w-full">
        {sorted.length === 0 ? (
          <EmptyState
            scope="panel"
            tone="empty"
            title={
              totalCount === 0 && !search && !statusFilter
                ? "이 차시에 수강생이 없습니다."
                : "검색 결과가 없습니다."
            }
            description={
              totalCount === 0 && !search && !statusFilter
                ? "위 '수강생 등록' 버튼으로 추가해 주세요."
                : "검색어나 필터를 변경해 보세요."
            }
            actions={
              totalCount === 0 && !search && !statusFilter && onOpenEnrollModal ? (
                <Button type="button" intent="primary" onClick={onOpenEnrollModal}>
                  수강생 등록
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div style={{ width: "fit-content" }}>
            <DomainTable tableClassName="ds-table--flat ds-table--attendance" tableStyle={{ minWidth: tableWidth, width: tableWidth, tableLayout: "fixed" }}>
              <colgroup>
                {attendanceColumnDefs.map((c) => (
                  <col key={c.key} style={{ width: columnWidths[c.key] ?? c.defaultWidth }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <ResizableTh
                    columnKey="checkbox"
                    width={columnWidths.checkbox ?? col.checkbox}
                    minWidth={40}
                    maxWidth={120}
                    onWidthChange={setColumnWidth}
                    scope="col"
                    className="ds-checkbox-cell"
                  >
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="전체 선택"
                      className="cursor-pointer"
                    />
                  </ResizableTh>
                  {sortHeader("name", "이름")}
                  {sortHeader("status", "상태")}
                  {sortHeader("parent_phone", "학부모 전화번호")}
                  {sortHeader("phone", "학생 전화번호")}
                  <ResizableTh
                    columnKey="memo"
                    width={columnWidths.memo ?? col.memo}
                    minWidth={140}
                    maxWidth={500}
                    onWidthChange={setColumnWidth}
                    scope="col"
                  >
                    메모
                  </ResizableTh>
                </tr>
              </thead>
              <tbody>
                {sorted.map((att: any) => (
                  <tr key={att.id} className={selectedSet.has(att.id) ? "ds-row-selected" : ""}>
                    <td className="ds-checkbox-cell" style={{ width: columnWidths.checkbox ?? col.checkbox }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedSet.has(att.id)}
                        onChange={() => toggleSelect(att.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`${att.name} 선택`}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="text-[15px] font-bold leading-6 text-[var(--color-text-primary)] truncate align-middle" style={{ width: columnWidths.name ?? col.name }}>
                      <StudentNameWithLectureChip
                        name={att.name ?? ""}
                        profilePhotoUrl={att.profile_photo_url ?? undefined}
                        avatarSize={24}
                        lectures={
                          att.lecture_title
                            ? [{ lectureName: att.lecture_title, color: att.lecture_color }]
                            : lecture
                              ? [{ lectureName: lecture.title, color: lecture.color }]
                              : undefined
                        }
                        chipSize={16}
                      />
                    </td>
                    <td className="text-center align-middle" style={{ width: columnWidths.status ?? col.statusBadge }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          if (openStatusRowAttId === att.id) {
                            setOpenStatusRowAttId(null);
                            setStatusRowPopoverAnchor(null);
                            statusRowTriggerRef.current = null;
                            return;
                          }
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setStatusRowPopoverAnchor({ left: rect.left, top: rect.top });
                          setOpenStatusRowAttId(att.id);
                          statusRowTriggerRef.current = e.currentTarget as HTMLElement;
                        }}
                        className="cursor-pointer rounded border-0 p-0 bg-transparent inline-flex align-middle focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-1"
                        aria-label={`${att.name ?? ""} 출결 상태 변경`}
                        aria-expanded={openStatusRowAttId === att.id}
                      >
                        <AttendanceStatusBadge status={att.status} variant="2ch" selected />
                      </button>
                    </td>
                    <td className="text-[14px] leading-6 text-[var(--color-text-secondary)] truncate align-middle" style={{ width: columnWidths.parent_phone ?? col.parentPhone }}>
                      {formatPhone(att.parent_phone)}
                    </td>
                    <td className="text-[14px] leading-6 text-[var(--color-text-secondary)] truncate align-middle" style={{ width: columnWidths.phone ?? col.studentPhone }}>
                      {formatPhone(att.phone ?? att.student_phone)}
                    </td>
                    <td className="align-middle" style={{ width: columnWidths.memo ?? col.memo }}>
                      <input
                        defaultValue={att.memo || ""}
                        placeholder="메모 입력"
                        className="ds-input w-full min-w-0 text-[14px] leading-6 py-1.5 text-[var(--color-text-secondary)]"
                        onBlur={(e) => updateMemo.mutate({ id: att.id, memo: e.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </DomainTable>
          </div>
        )}
      </div>
    </div>
  );
}
