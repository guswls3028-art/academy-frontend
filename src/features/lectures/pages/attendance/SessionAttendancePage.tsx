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
} from "@/features/lectures/api/attendance";
import api from "@/shared/api/axios";
import { EmptyState, Button } from "@/shared/ui/ds";
import { DomainListToolbar, DomainTable } from "@/shared/ui/domain";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import AttendanceStatusBadge, {
  ORDERED_ATTENDANCE_STATUS,
  type AttendanceStatus,
} from "@/shared/ui/badges/AttendanceStatusBadge";
import { formatPhone } from "@/shared/utils/formatPhone";
import { feedback } from "@/shared/ui/feedback/feedback";

const STATUS_LIST = ORDERED_ATTENDANCE_STATUS;

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
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState("-name");
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const statusTriggerRef = useRef<HTMLButtonElement>(null);
  const statusPopoverRef = useRef<HTMLDivElement>(null);
  const [statusPopoverAnchor, setStatusPopoverAnchor] = useState<{ left: number; top: number } | null>(null);

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
    if (!statusPopoverOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (statusTriggerRef.current?.contains(target) || statusPopoverRef.current?.contains(target)) return;
      setStatusPopoverOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [statusPopoverOpen]);

  const { data: attendance, isLoading } = useQuery({
    queryKey: ["attendance", sessionId],
    queryFn: () => fetchAttendance(sessionId),
    enabled: Number.isFinite(sessionId),
  });

  const { data: lecture } = useQuery({
    queryKey: ["lecture", lectureId],
    queryFn: async () => (await api.get(`/lectures/lectures/${lectureId}/`)).data,
    enabled: Number.isFinite(lectureId ?? 0),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: AttendanceStatus }) =>
      updateAttendance(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance", sessionId] }),
  });

  const updateMemo = useMutation({
    mutationFn: ({ id, memo }: { id: number; memo: string }) =>
      updateAttendance(id, { memo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance", sessionId] }),
  });

  const filtered = useMemo(() => {
    if (!attendance) return [];
    let list = attendance.filter((att: any) => matchSearch(att, search));
    if (statusFilter) list = list.filter((att: any) => att.status === statusFilter);
    return list;
  }, [attendance, search, statusFilter]);

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

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!attendance || attendance.length === 0) return <EmptyState scope="panel" title="출결 데이터 없음" />;

  const allIds = sorted.map((att: any) => att.id);
  const allSelected = sorted.length > 0 && allIds.every((id: number) => selectedSet.has(id));

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
    feedback.info("메시지 발송 기능 준비 중입니다.");
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
    if (
      !window.confirm(
        `선택한 ${selectedIds.length}명을 이 차시 출결에서 제외하시겠습니까?\n(수강생 등록은 유지되며, 출결 기록만 제거됩니다.)`
      )
    )
      return;
    const count = selectedIds.length;
    setDeleting(true);
    try {
      await Promise.all(selectedIds.map((id) => deleteAttendance(id)));
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
  );

  // 컬럼별 영역: 출결변경 10개 뱃지 한 줄 유지(줄바꿈 없음)
  const col = {
    checkbox: 48,
    name: 100,
    status: 68,
    parentPhone: 120,
    studentPhone: 120,
    attendanceChange: 460,
    memo: 336,
  };
  const tableMinWidth = col.checkbox + col.name + col.status + col.parentPhone + col.studentPhone + col.attendanceChange + col.memo;

  const primaryAction =
    onOpenEnrollModal ? (
      <Button type="button" intent="primary" size="sm" onClick={onOpenEnrollModal}>
        수강생 등록
      </Button>
    ) : null;

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
            "상태"
          )}
        </Button>
      </span>
      {statusPopoverOpen && statusPopoverAnchor &&
        createPortal(
          <div
            ref={statusPopoverRef}
            className="fixed flex flex-wrap items-center gap-2 rounded-lg border p-2 shadow-lg"
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
                  onClick={() => { setStatusFilter(code); setStatusPopoverOpen(false); }}
                  className="cursor-pointer rounded border-0 p-0.5 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]/40"
                  style={{
                    opacity: selected ? 1 : 0.85,
                    boxShadow: selected ? "0 0 0 2px var(--color-primary)" : undefined,
                  }}
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
    return (
      <th
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
      </th>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DomainListToolbar
        totalLabel={`총 ${sorted.length}명`}
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
        <div style={{ width: "fit-content" }}>
          <DomainTable tableClassName="ds-table--flat ds-table--attendance" tableStyle={{ minWidth: tableMinWidth, width: "100%", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: col.checkbox }} />
              <col style={{ width: col.name }} />
              <col style={{ width: col.status }} />
              <col style={{ width: col.parentPhone }} />
              <col style={{ width: col.studentPhone }} />
              <col style={{ width: col.attendanceChange }} />
              <col style={{ width: col.memo }} />
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
                {sortHeader("name", "이름")}
                {sortHeader("status", "상태")}
                {sortHeader("parent_phone", "학부모 전화번호")}
                {sortHeader("phone", "학생 전화번호")}
                <th scope="col">출결 변경</th>
                <th scope="col">메모</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-[var(--color-text-muted)]">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                sorted.map((att: any) => (
                  <tr key={att.id} className={selectedSet.has(att.id) ? "ds-row-selected" : ""}>
                    <td className="ds-checkbox-cell" style={{ width: col.checkbox }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedSet.has(att.id)}
                        onChange={() => toggleSelect(att.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`${att.name} 선택`}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="text-[15px] font-bold leading-6 text-[var(--color-text-primary)] truncate align-middle">
                      <StudentNameWithLectureChip
                        name={att.name ?? ""}
                        lectures={
                          att.lecture_title
                            ? [{ lectureName: att.lecture_title, color: att.lecture_color }]
                            : lecture
                              ? [{ lectureName: lecture.title, color: lecture.color }]
                              : []
                        }
                        chipSize={16}
                      />
                    </td>
                    <td className="text-center align-middle">
                      <AttendanceStatusBadge status={att.status} variant="2ch" />
                    </td>
                    <td className="text-[14px] leading-6 text-[var(--color-text-secondary)] truncate align-middle">
                      {formatPhone(att.parent_phone)}
                    </td>
                    <td className="text-[14px] leading-6 text-[var(--color-text-secondary)] truncate align-middle">
                      {formatPhone(att.phone ?? att.student_phone)}
                    </td>
                    <td className="align-middle">
                      <div className="flex flex-nowrap gap-1" style={{ width: "fit-content" }}>
                        {STATUS_LIST.map((code) => {
                          const active = att.status === code;
                          return (
                            <button
                              key={code}
                              type="button"
                              aria-pressed={active}
                              onClick={() => {
                                if (active) return;
                                updateStatus.mutate({ id: att.id, status: code });
                              }}
                              className="cursor-pointer rounded border-0 p-0.5 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]/40 disabled:cursor-default"
                              style={{ opacity: active ? 1 : 0.4, filter: active ? "none" : "grayscale(1)" }}
                            >
                              <AttendanceStatusBadge status={code} variant="2ch" />
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="align-middle">
                      <input
                        defaultValue={att.memo || ""}
                        placeholder="메모 입력"
                        className="ds-input w-full min-w-0 text-[14px] leading-6 py-1.5 text-[var(--color-text-secondary)]"
                        onBlur={(e) => updateMemo.mutate({ id: att.id, memo: e.target.value })}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </DomainTable>
        </div>
      </div>
    </div>
  );
}
