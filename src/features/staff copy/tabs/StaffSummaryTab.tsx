// PATH: src/features/staff/tabs/StaffSummaryTab.tsx
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardBody } from "@/shared/ui/card";

import { fetchStaffSummaryByRange } from "../api/staff.detail.api";
import {
  fetchWorkMonthLocks,
  isLockedFromLocks,
} from "../api/staffWorkMonthLock.api";

/* =========================
 * Utils
 * ========================= */

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getMonthBoundsFrom(dateISO: string) {
  const y = Number(dateISO.slice(0, 4));
  const m = Number(dateISO.slice(5, 7));
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to, year: y, month: m };
}

/* =========================
 * Component
 * ========================= */

export default function StaffSummaryTab() {
  const { staffId } = useParams();
  const sid = Number(staffId);

  const baseDate = todayISO();
  const range = getMonthBoundsFrom(baseDate);

  // ✅ Summary (Backend Truth)
  const summaryQ = useQuery({
    queryKey: ["staff-summary-tab", sid, range.from, range.to],
    queryFn: () =>
      fetchStaffSummaryByRange(sid, range.from, range.to),
    enabled: !!sid,
  });

  // ✅ Month Lock (Backend Truth)
  const locksQ = useQuery({
    queryKey: ["work-month-locks", sid, range.year, range.month],
    queryFn: () =>
      fetchWorkMonthLocks({
        staff: sid,
        year: range.year,
        month: range.month,
      }),
    enabled: !!sid,
  });

  const locked = isLockedFromLocks(locksQ.data);

  if (summaryQ.isLoading || locksQ.isLoading) {
    return <div className="text-sm text-[var(--text-muted)]">불러오는 중...</div>;
  }

  if (!summaryQ.data) {
    return <div className="text-sm text-[var(--text-muted)]">데이터가 없습니다.</div>;
  }

  const summary = summaryQ.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Item label="총 근무시간" value={`${summary.work_hours} h`} />
          <Item
            label="급여 합계"
            value={`${summary.work_amount.toLocaleString()} 원`}
          />
          <Item
            label="비용 합계"
            value={`${summary.expense_amount.toLocaleString()} 원`}
          />
          <Item
            label="실 지급액"
            value={`${summary.total_amount.toLocaleString()} 원`}
            primary
          />
        </CardBody>
      </Card>

      <div className="flex items-center justify-between text-xs">
        <div className="text-[var(--text-muted)]">
          기준 기간: {range.from} ~ {range.to}
        </div>

        <div
          className={[
            "px-2 py-0.5 rounded-full font-semibold",
            locked
              ? "bg-red-100 text-red-700"
              : "bg-green-100 text-green-700",
          ].join(" ")}
        >
          {locked ? "마감됨" : "진행중"}
        </div>
      </div>
    </div>
  );
}

/* =========================
 * UI
 * ========================= */

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
          primary
            ? "text-[var(--color-primary)]"
            : "text-[var(--text-primary)]",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}
