// PATH: src/features/staff/pages/ReportsPage/PayrollSnapshotList.tsx
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  fetchPayrollSnapshots,
  exportPayrollSnapshotExcel,
} from "../../api/payrollSnapshots.api";
import { exportPayrollSnapshotPDF } from "../../api/payrollSnapshotPDF.api";
import ActionButton from "../../components/ActionButton";

export default function PayrollSnapshotList({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const { staffId } = useParams();
  const sid = staffId ? Number(staffId) : undefined;

  const listQ = useQuery({
    queryKey: ["payroll-snapshots", sid, year, month],
    queryFn: () => fetchPayrollSnapshots({ staff: sid, year, month }),
    enabled: typeof sid === "number" && sid > 0,
  });

  const rows = useMemo(() => listQ.data ?? [], [listQ.data]);

  if (!sid) {
    return (
      <div className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)] px-5 py-4 text-sm text-[var(--text-muted)]">
        직원 상세 화면에서만 확인 가능합니다.
      </div>
    );
  }

  if (listQ.isLoading) {
    return <div className="text-sm text-[var(--text-muted)]">불러오는 중...</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-5 py-6">
        <div className="text-sm font-semibold">확정 급여 없음</div>
        <div className="text-xs text-[var(--text-muted)] mt-1">
          해당 월은 아직 마감되지 않았거나 급여 스냅샷이 생성되지 않았습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div
          key={r.id}
          className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)] px-5 py-4"
        >
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1">
              <div className="text-sm font-semibold">
                {r.year}-{String(r.month).padStart(2, "0")} 급여
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                생성일: {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
              </div>
              {!!r.generated_by_name && (
                <div className="text-xs text-[var(--text-muted)]">
                  생성자: {r.generated_by_name}
                </div>
              )}
            </div>

            <div className="text-right space-y-2">
              <div className="text-lg font-semibold">{r.total_amount.toLocaleString()}원</div>

              <div className="flex gap-2 justify-end">
                <ActionButton
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    exportPayrollSnapshotPDF({
                      staff: sid as number,
                      year: r.year,
                      month: r.month,
                    })
                  }
                >
                  PDF
                </ActionButton>

                <ActionButton
                  variant="outline"
                  size="xs"
                  title="엑셀은 해당 월 전체 직원 급여입니다."
                  onClick={() =>
                    exportPayrollSnapshotExcel({
                      year: r.year,
                      month: r.month,
                    })
                  }
                >
                  XLSX
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="text-[11px] text-[var(--text-muted)]">
        * Payroll Snapshot은 마감 시점 확정 데이터이며 수정할 수 없습니다.
      </div>
    </div>
  );
}
