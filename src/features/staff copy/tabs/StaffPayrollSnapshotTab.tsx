// PATH: src/features/staff/tabs/StaffPayrollSnapshotTab.tsx
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Panel } from "@/shared/ui/ds";


import {
  fetchPayrollSnapshots,
  exportPayrollSnapshotExcel,
} from "../api/payrollSnapshot.api";
import { exportPayrollSnapshotPdf } from "../api/payrollSnapshotPdf.api";

/* =========================
 * Utils
 * ========================= */

function currentYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/* =========================
 * Component
 * ========================= */

export default function StaffPayrollSnapshotTab() {
  const { staffId } = useParams();
  const sid = Number(staffId);

  const [ym, setYm] = useState(() => currentYearMonth());

  const listQ = useQuery({
    queryKey: ["payroll-snapshots", sid, ym.year, ym.month],
    queryFn: () =>
      fetchPayrollSnapshots({
        staff: sid,
        year: ym.year,
        month: ym.month,
      }),
    enabled: !!sid,
  });

  const snapshot = listQ.data?.[0];
  const label = useMemo(
    () => `${ym.year}-${String(ym.month).padStart(2, "0")}`,
    [ym]
  );

  if (listQ.isLoading) {
    return <div className="text-sm text-[var(--text-muted)]">불러오는 중...</div>;
  }

  if (!snapshot) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-semibold">급여 스냅샷</div>
        <div className="text-sm text-[var(--text-muted)]">
          해당 월은 아직 마감되지 않았습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold">급여 스냅샷</div>
          <div className="text-xs text-[var(--text-muted)]">정산 월: {label}</div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={ym.year}
            onChange={(e) =>
              setYm((p) => ({ ...p, year: Number(e.target.value) }))
            }
            className="h-[38px] rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 text-sm outline-none"
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
            className="h-[38px] rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 text-sm outline-none"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>

          <button
            onClick={() =>
              exportPayrollSnapshotPdf({
                staff: sid,
                year: ym.year,
                month: ym.month,
              })
            }
            className="h-[38px] px-4 rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] text-sm font-semibold hover:bg-[var(--bg-surface-soft)]"
            title="PDF 급여명세서 다운로드"
          >
            PDF
          </button>

          <button
            onClick={() =>
              exportPayrollSnapshotExcel({
                year: ym.year,
                month: ym.month,
              })
            }
            className="btn-primary"
            title="엑셀(.xlsx) 다운로드"
          >
            XLSX
          </button>
        </div>
      </div>

      {/* Snapshot Summary */}
      <Card>
        <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Item label="근무시간" value={`${snapshot.work_hours} h`} />
          <Item
            label="급여"
            value={`${snapshot.work_amount.toLocaleString()} 원`}
          />
          <Item
            label="승인 비용"
            value={`${snapshot.approved_expense_amount.toLocaleString()} 원`}
          />
          <Item
            label="실 지급액"
            value={`${snapshot.total_amount.toLocaleString()} 원`}
            primary
          />
        </CardBody>
      </Card>

      <div className="text-xs text-[var(--text-muted)]">
        * 본 데이터는 월 마감 시 생성된 급여 스냅샷이며 수정할 수 없습니다.
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
