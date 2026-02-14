// PATH: src/features/staff/pages/ReportsPage/ReportsPage.tsx
// SSOT: 페이지 탭 → 플랫탭 (ds-tabs--flat + ds-tab)
import { useMemo, useState } from "react";
import PayrollSnapshotList from "./PayrollSnapshotList";
import PayrollHistoryTable from "./PayrollHistoryTable";
import WorkMonthLockHistory from "./WorkMonthLockHistory";

function ymLabel(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

type ReportTabKey = "snapshot" | "history" | "lock";

const REPORT_TABS: { key: ReportTabKey; label: string }[] = [
  { key: "snapshot", label: "Payroll Snapshot" },
  { key: "history", label: "Payroll History" },
  { key: "lock", label: "Month Lock History" },
];

export default function ReportsPage() {
  const now = useMemo(() => new Date(), []);
  const [ym, setYm] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const [activeTab, setActiveTab] = useState<ReportTabKey>("snapshot");

  return (
    <div className="p-6 space-y-4">
      {/* 기준 월 헤더 */}
      <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-lg font-semibold">리포트</div>
            <div className="text-sm text-[var(--text-muted)]">
              기준월 <b>{ymLabel(ym.year, ym.month)}</b> · 모든 수치는{" "}
              <b>서버 확정 데이터</b> 기준입니다.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={ym.year}
              onChange={(e) =>
                setYm((p) => ({ ...p, year: Number(e.target.value) }))
              }
              className="h-[36px] rounded-lg border border-[var(--border-divider)] px-3 text-sm bg-[var(--bg-surface)]"
            >
              {[ym.year - 1, ym.year, ym.year + 1].map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>

            <select
              value={ym.month}
              onChange={(e) =>
                setYm((p) => ({ ...p, month: Number(e.target.value) }))
              }
              className="h-[36px] rounded-lg border border-[var(--border-divider)] px-3 text-sm bg-[var(--bg-surface)]"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-2 text-[11px] text-[var(--text-muted)]">
          * Payroll Snapshot은 <b>월 마감 시 생성</b>되며 이후 수정되지 않습니다.
        </div>
      </div>

      <div className="ds-tabs ds-tabs--flat border-b border-[var(--color-border-divider)] mb-4" role="tablist">
        {REPORT_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={activeTab === t.key}
            onClick={() => setActiveTab(t.key)}
            className={`ds-tab ${activeTab === t.key ? "is-active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {activeTab === "snapshot" && (
        <PayrollSnapshotList year={ym.year} month={ym.month} />
      )}
      {activeTab === "history" && <PayrollHistoryTable />}
      {activeTab === "lock" && (
        <WorkMonthLockHistory year={ym.year} month={ym.month} />
      )}
    </div>
  );
}
