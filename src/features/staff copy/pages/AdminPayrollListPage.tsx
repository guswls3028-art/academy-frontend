// PATH: src/features/staff/pages/AdminPayrollListPage.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Page, PageHeader, PageSection } from "@/shared/ui/page";
import { Card, CardBody } from "@/shared/ui/card";

import {
  fetchPayrollSnapshots,
  exportPayrollSnapshotExcel,
  PayrollSnapshot,
} from "../api/payrollSnapshot.api";

/* =========================
 * Utils
 * ========================= */

function currentYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function ymLabel(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

/* =========================
 * Component
 * ========================= */

export default function AdminPayrollListPage() {
  const [ym, setYm] = useState(() => currentYearMonth());

  const listQ = useQuery({
    queryKey: ["admin-payroll-snapshots", ym.year, ym.month],
    queryFn: () =>
      fetchPayrollSnapshots({
        year: ym.year,
        month: ym.month,
      }),
  });

  const rows = (listQ.data ?? []) as PayrollSnapshot[];

  const totals = rows.reduce(
    (acc, r) => {
      acc.workHours += Number(r.work_hours || 0);
      acc.totalAmount += Number(r.total_amount || 0);
      return acc;
    },
    { workHours: 0, totalAmount: 0 }
  );

  return (
    <Page>
      <PageHeader
        title="월별 급여 정산"
        description={`급여 확정 스냅샷 · ${ymLabel(ym.year, ym.month)}`}
        actions={
          <button
            onClick={() =>
              exportPayrollSnapshotExcel({
                year: ym.year,
                month: ym.month,
              })
            }
            className="btn-primary"
          >
            엑셀 다운로드
          </button>
        }
      />

      <PageSection>
        <div className="flex items-center gap-2 mb-4">
          <select
            value={ym.year}
            onChange={(e) =>
              setYm((p) => ({ ...p, year: Number(e.target.value) }))
            }
            className="input w-[100px]"
          >
            {[ym.year - 1, ym.year, ym.year + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            value={ym.month}
            onChange={(e) =>
              setYm((p) => ({ ...p, month: Number(e.target.value) }))
            }
            className="input w-[100px]"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
        </div>

        <Card>
          <CardBody className="p-0">
            <div className="grid grid-cols-[180px_120px_140px_140px_160px] gap-4 px-4 py-3 text-xs font-semibold text-[var(--text-muted)] border-b">
              <div>직원</div>
              <div>근무시간</div>
              <div>급여</div>
              <div>비용</div>
              <div>실지급액</div>
            </div>

            {rows.length === 0 && (
              <div className="px-4 py-6 text-sm text-[var(--text-muted)]">
                해당 월에 마감된 급여가 없습니다.
              </div>
            )}

            {rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[180px_120px_140px_140px_160px] gap-4 px-4 py-3 text-sm border-b last:border-b-0"
              >
                <div className="font-semibold">
                  {r.staff_name ?? `Staff#${r.staff}`}
                </div>
                <div>{r.work_hours} h</div>
                <div>{r.work_amount.toLocaleString()}원</div>
                <div>
                  {r.approved_expense_amount.toLocaleString()}원
                </div>
                <div className="font-semibold text-[var(--color-primary)]">
                  {r.total_amount.toLocaleString()}원
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        {rows.length > 0 && (
          <div className="mt-3 text-xs text-[var(--text-muted)]">
            총 근무시간: {totals.workHours} h · 총 지급액:{" "}
            {totals.totalAmount.toLocaleString()}원
          </div>
        )}
      </PageSection>
    </Page>
  );
}
