// PATH: src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffReportTab.tsx

import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchStaffSummaryByRange } from "../../api/staff.detail.api";
import { staffQueryKeys } from "../../queryKeys";
import { Button, EmptyState } from "@/shared/ui/ds";
import styles from "./StaffReportTab.module.css";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

  const [range] = useState(() => getMonthBoundsFrom(todayISO()));
  const monthLabel = useMemo(() => `${range.from} ~ ${range.to}`, [range.from, range.to]);

  const summaryQ = useQuery({
    queryKey: staffQueryKeys.reportSummary(sid, range.from, range.to),
    queryFn: () => fetchStaffSummaryByRange(sid, range.from, range.to),
    enabled: !!sid,
  });

  if (summaryQ.isLoading) {
    return <div className="text-sm text-[var(--color-text-muted)]">불러오는 중...</div>;
  }

  if (summaryQ.isError) {
    return (
      <EmptyState
        scope="panel"
        tone="error"
        title="직원 리포트를 불러올 수 없습니다"
        actions={
          <Button intent="secondary" size="sm" onClick={() => summaryQ.refetch()}>
            다시 시도
          </Button>
        }
      />
    );
  }

  if (!summaryQ.data) {
    return <div className="text-sm text-[var(--color-text-muted)]">데이터가 없습니다.</div>;
  }

  const s = summaryQ.data;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold">리포트</div>
          <div className="text-xs text-[var(--color-text-muted)]">기간: {monthLabel}</div>
        </div>
      </div>

      <div
        className={`rounded-xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-4 ${styles.summaryCard}`}
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Item label="근무시간" value={`${s.work_hours} h`} />
          <Item label="근무기록 금액" value={`${s.work_amount.toLocaleString()} 원`} />
          <Item label="승인 선결제 환급" value={`${s.expense_amount.toLocaleString()} 원`} />
          <Item label="공제 전 합계" value={`${s.total_amount.toLocaleString()} 원`} primary />
        </div>
      </div>

      <div className="text-xs text-[var(--color-text-muted)]">
        * 서버 집계 기준이며 세금·4대보험·기타 공제는 반영하지 않습니다.
      </div>
    </div>
  );
}

function Item({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-3">
      <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
      <div
        className={[
          "mt-1 text-lg font-semibold",
          primary ? "text-[var(--color-primary)]" : "text-[var(--color-text-primary)]",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}
