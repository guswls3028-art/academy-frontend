// PATH: src/features/staff/tabs/StaffReportTab.tsx
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardBody } from "@/shared/ui/card";

import { fetchStaffSummaryByRange } from "../api/staff.detail.api";
import { exportStaffReportXlsx } from "../api/staffReport.api";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getMonthBoundsFrom(dateISO: string) {
  const y = Number(dateISO.slice(0, 4));
  const m = Number(dateISO.slice(5, 7));
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export default function StaffReportTab() {
  const { staffId } = useParams();
  const sid = Number(staffId);

  const [range, setRange] = useState(() => getMonthBoundsFrom(todayISO()));
  const monthLabel = useMemo(() => `${range.from} ~ ${range.to}`, [range.from, range.to]);

  const summaryQ = useQuery({
    queryKey: ["staff-report-summary", sid, range.from, range.to],
    queryFn: () => fetchStaffSummaryByRange(sid, range.from, range.to),
    enabled: !!sid,
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <div className="text-xs font-medium text-[var(--text-muted)]">기간 시작</div>
            <input
              type="date"
              value={range.from}
              onChange={(e) => setRange((p) => ({ ...p, from: e.target.value }))}
              className="h-[38px] rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 text-sm outline-none"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-[var(--text-muted)]">기간 종료</div>
            <input
              type="date"
              value={range.to}
              onChange={(e) => setRange((p) => ({ ...p, to: e.target.value }))}
              className="h-[38px] rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 text-sm outline-none"
            />
          </div>

          <div className="pb-[2px] text-xs text-[var(--text-muted)]">{monthLabel}</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => summaryQ.refetch()}
            className="h-[38px] px-4 rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] text-sm font-semibold hover:bg-[var(--bg-surface-soft)]"
          >
            새로고침
          </button>

          <button
            onClick={async () => {
              await exportStaffReportXlsx({
                staffId: sid,
                date_from: range.from,
                date_to: range.to,
              });
            }}
            className="btn-primary"
          >
            엑셀 다운로드 (.xlsx)
          </button>
        </div>
      </div>

      {/* Summary */}
      {summaryQ.isLoading && (
        <div className="text-sm text-[var(--text-muted)]">불러오는 중...</div>
      )}

      {!summaryQ.isLoading && summaryQ.data && (
        <Card>
          <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Item label="근무시간" value={`${summaryQ.data.work_hours} h`} />
            <Item label="급여" value={`${summaryQ.data.work_amount.toLocaleString()} 원`} />
            <Item label="비용" value={`${summaryQ.data.expense_amount.toLocaleString()} 원`} />
            <Item
              label="실 지급액"
              value={`${summaryQ.data.total_amount.toLocaleString()} 원`}
              primary
            />
          </CardBody>
        </Card>
      )}

      <div className="text-xs text-[var(--text-muted)]">
        * 엑셀에는 Summary / WorkRecords / Expenses 시트가 포함됩니다.
      </div>
    </div>
  );
}

function Item({
  label,
  value,
  primary,
}: {
  label: string;
  value: string;
  primary?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div
        className={[
          "mt-1 text-lg font-semibold",
          primary ? "text-[var(--color-primary)]" : "text-[var(--text-primary)]",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}
