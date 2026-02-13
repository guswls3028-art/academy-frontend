// PATH: src/features/lectures/pages/attendance/SessionAttendancePage.tsx
// Design: students 도메인과 동일한 툴바·테이블 구조 (DomainListToolbar + DomainTable)
import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAttendance,
  updateAttendance,
  deleteAttendance,
  downloadAttendanceExcel,
} from "@/features/lectures/api/attendance";
import { EmptyState, Button } from "@/shared/ui/ds";
import { DomainListToolbar, DomainTable } from "@/shared/ui/domain";
import AttendanceStatusBadge from "@/shared/ui/badges/AttendanceStatusBadge";
import { formatPhone } from "@/shared/utils/formatPhone";
import { feedback } from "@/shared/ui/feedback/feedback";

const STATUS_LIST = [
  "PRESENT",      // 현장
  "ONLINE",       // 영상
  "SUPPLEMENT",   // 보강
  "MATERIAL",     // 자료
  "LATE",         // 지각
  "EARLY_LEAVE",  // 조퇴
  "RUNAWAY",      // 출튀
  "ABSENT",       // 결석
] as const;

type AttendanceStatus = (typeof STATUS_LIST)[number];

type SessionAttendancePageProps = {
  sessionId: number;
  /** 출결 엑셀 다운로드용 (강의 단위) */
  lectureId?: number;
  /** 출결 탭에서 툴바 액션 노출 (students 도메인 정합성) */
  onOpenEnrollModal?: () => void;
  onOpenStudentModal?: () => void;
  onCopyFromPrev?: () => void;
  copyFromPrevDisabled?: boolean;
  copyFromPrevLabel?: string;
};

export default function SessionAttendancePage({
  sessionId,
  lectureId,
  onOpenEnrollModal,
  onOpenStudentModal,
  onCopyFromPrev,
  copyFromPrevDisabled = true,
  copyFromPrevLabel = "직전 차시에서 가져오기",
}: SessionAttendancePageProps) {
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);

  const { data: attendance, isLoading } = useQuery({
    queryKey: ["attendance", sessionId],
    queryFn: () => fetchAttendance(sessionId),
    enabled: Number.isFinite(sessionId),
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

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!attendance || attendance.length === 0) return <EmptyState scope="panel" title="출결 데이터 없음" />;

  const allIds = attendance.map((att: any) => att.id);
  const allSelected = attendance.length > 0 && allIds.every((id: number) => selectedSet.has(id));

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

  // 컬럼 너비 합: 48+144+100+75+75+520+360 = 1322
  const tableMinWidth = 1322;

  const primaryAction =
    onOpenEnrollModal || onOpenStudentModal ? (
      <div className="flex items-center gap-2">
        {onOpenEnrollModal && (
          <Button type="button" intent="primary" size="sm" onClick={onOpenEnrollModal}>
            수강생 등록
          </Button>
        )}
        {onOpenStudentModal && (
          <Button type="button" intent="secondary" size="sm" onClick={onOpenStudentModal}>
            학생 추가
          </Button>
        )}
      </div>
    ) : null;

  const filterSlot =
    onCopyFromPrev ? (
      <Button
        type="button"
        intent="secondary"
        size="sm"
        disabled={copyFromPrevDisabled}
        onClick={onCopyFromPrev}
      >
        {copyFromPrevLabel}
      </Button>
    ) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <DomainListToolbar
        totalLabel={`총 ${attendance.length}명`}
        searchSlot={null}
        filterSlot={filterSlot}
        primaryAction={primaryAction}
        belowSlot={selectionBar}
      />
      <div className="overflow-x-auto w-full">
        <div style={{ width: "fit-content" }}>
          <DomainTable tableClassName="ds-table--flat" tableStyle={{ minWidth: tableMinWidth, width: "100%", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 48 }} />
            <col style={{ width: 144 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 75 }} />
            <col style={{ width: 75 }} />
            <col style={{ width: 520 }} />
            <col style={{ width: 360 }} />
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
              <th scope="col" className="text-center">상태</th>
              <th scope="col">학생 전화번호</th>
              <th scope="col">학부모 전화번호</th>
              <th scope="col">출결 변경</th>
              <th scope="col">메모</th>
            </tr>
          </thead>
          <tbody>
            {attendance.map((att: any) => (
              <tr key={att.id} className={selectedSet.has(att.id) ? "ds-row-selected" : ""}>
                <td className="ds-checkbox-cell" style={{ width: 48 }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedSet.has(att.id)}
                    onChange={() => toggleSelect(att.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`${att.name} 선택`}
                    className="cursor-pointer"
                  />
                </td>
                <td className="text-[15px] font-bold leading-6 text-[var(--color-text-primary)] truncate">
                  {att.name}
                </td>
                <td className="text-center">
                  <AttendanceStatusBadge status={att.status} />
                </td>
                <td className="text-[14px] leading-6 text-[var(--color-text-secondary)] truncate">
                  {formatPhone(att.phone ?? att.student_phone)}
                </td>
                <td className="text-[14px] leading-6 text-[var(--color-text-secondary)] truncate">
                  {formatPhone(att.parent_phone)}
                </td>
                <td>
                  <div className="flex flex-wrap gap-1.5" style={{ width: "fit-content" }}>
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
                          className="cursor-pointer rounded border-0 p-0.5 opacity-100 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]/40 disabled:cursor-default"
                          style={{ opacity: active ? 1 : 0.75 }}
                        >
                          <AttendanceStatusBadge status={code} />
                        </button>
                      );
                    })}
                  </div>
                </td>
                <td>
                  <input
                    defaultValue={att.memo || ""}
                    placeholder="메모 입력"
                    className="ds-input w-full min-w-0"
                    onBlur={(e) => updateMemo.mutate({ id: att.id, memo: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          </DomainTable>
        </div>
      </div>
    </div>
  );
}
