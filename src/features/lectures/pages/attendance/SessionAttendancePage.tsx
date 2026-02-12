// PATH: src/features/lectures/pages/attendance/SessionAttendancePage.tsx
import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAttendance, updateAttendance } from "@/features/lectures/api/attendance";
import { EmptyState, Button } from "@/shared/ui/ds";
import { DomainTable } from "@/shared/ui/domain";
import AttendanceStatusBadge from "@/shared/ui/badges/AttendanceStatusBadge";
import { formatPhone } from "@/shared/utils/formatPhone";

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

export default function SessionAttendancePage({ sessionId }: { sessionId: number }) {
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

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

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!attendance || attendance.length === 0) return <EmptyState scope="panel" title="출결 데이터 없음" />;

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
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

  const selectionBar = (
    <div className="flex flex-wrap items-center gap-2">
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
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {selectionBar}
      <DomainTable tableClassName="ds-table--flat" tableStyle={{ minWidth: 1232, width: "100%", tableLayout: "fixed" }}>
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
                <td className="text-left text-[15px] font-bold text-[var(--color-text-primary)] truncate">
                  {att.name}
                </td>

                <td className="text-center">
                  <AttendanceStatusBadge status={att.status} />
                </td>

                <td className="text-left text-[14px] text-[var(--color-text-secondary)] truncate">
                  {formatPhone(att.phone ?? att.student_phone)}
                </td>

                <td className="text-left text-[14px] text-[var(--color-text-muted)] truncate">
                  {formatPhone(att.parent_phone)}
                </td>

                <td>
                  <div style={{ display: "flex", flexWrap: "nowrap", gap: 8, width: "fit-content" }}>
                    {STATUS_LIST.map((code) => {
                      const active = att.status === code;
                      return (
                        <div
                          key={code}
                          role="button"
                          aria-pressed={active}
                          onClick={() => {
                            if (active) return;
                            updateStatus.mutate({ id: att.id, status: code });
                          }}
                          style={{
                            cursor: active ? "default" : "pointer",
                            opacity: active ? 1 : 0.7,
                            transition: "opacity 120ms ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!active) (e.currentTarget as HTMLDivElement).style.opacity = "1";
                          }}
                          onMouseLeave={(e) => {
                            if (!active) (e.currentTarget as HTMLDivElement).style.opacity = "0.7";
                          }}
                        >
                          <AttendanceStatusBadge status={code} />
                        </div>
                      );
                    })}
                  </div>
                </td>

                <td>
                  <input
                    defaultValue={att.memo || ""}
                    placeholder="메모 입력"
                    className="ds-input w-full"
                    onBlur={(e) => updateMemo.mutate({ id: att.id, memo: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </DomainTable>
    </div>
  );
}
