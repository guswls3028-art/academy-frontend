// PATH: src/features/staff/tabs/StaffPayrollHistoryTab.tsx
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardBody } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/feedback";

import {
  fetchPayrollSnapshots,
  exportPayrollSnapshotExcel,
  PayrollSnapshot,
} from "../api/payrollSnapshot.api";
import { exportPayrollSnapshotPdf } from "../api/payrollSnapshotPdf.api";

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

function safeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* =========================
 * Component
 * ========================= */

export default function StaffPayrollHistoryTab() {
  const { staffId } = useParams();
  const sid = Number(staffId);

  const now = useMemo(() => currentYearMonth(), []);
  const [year, setYear] = useState<number>(now.year);
  const [month, setMonth] = useState<number | "ALL">("ALL");

  const listQ = useQuery({
    queryKey: ["payroll-snapshots-history", sid, year, month],
    queryFn: () =>
      fetchPayrollSnapshots({
        staff: sid,
        year,
        month: month === "ALL" ? undefined : month,
      }),
    enabled: !!sid && !!year,
  });

  const rows = (listQ.data ?? []) as PayrollSnapshot[];

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.workHours += safeNumber(r.work_hours);
        acc.workAmount += safeNumber(r.work_amount);
        acc.expenseAmount += safeNumber(r.approved_expense_amount);
        acc.totalAmount += safeNumber(r.total_amount);
        return acc;
      },
      { workHours: 0, workAmount: 0, expenseAmount: 0, totalAmount: 0 }
    );
  }, [rows]);

  const canExcel = month !== "ALL";

  if (listQ.isLoading) {
    return <div className="text-sm text-[var(--text-muted)]">불러오는 중...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <div className="text-sm font-semibold">급여 히스토리</div>
        <div className="text-xs text-[var(--text-muted)]">
          월 마감 시 생성된 급여 스냅샷(확정 데이터) · 수정 불가
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <div className="text-xs font-medium text-[var(--text-muted)]">연도</div>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-[38px] rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 text-sm outline-none"
            >
              {[now.year - 1, now.year, now.year + 1].map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-[var(--text-muted)]">월</div>
            <select
              value={month}
              onChange={(e) => {
                const v = e.target.value;
                setMonth(v === "ALL" ? "ALL" : Number(v));
              }}
              className="h-[38px] rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 text-sm outline-none"
            >
              <option value="ALL">전체</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
          </div>

          <div className="pb-[2px] text-xs text-[var(--text-muted)]">
            {month === "ALL" ? `${year}년 전체` : `${ymLabel(year, month)} 기준`}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => listQ.refetch()}
            className="h-[38px] px-4 rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] text-sm font-semibold hover:bg-[var(--bg-surface-soft)]"
          >
            새로고침
          </button>

          <button
            disabled={!canExcel}
            title={
              canExcel
                ? "선택된 월의 급여 스냅샷을 엑셀로 다운로드합니다."
                : "월을 선택하면 엑셀 다운로드가 가능합니다."
            }
            onClick={() => {
              if (!canExcel) return;
              exportPayrollSnapshotExcel({
                year,
                month: month as number,
              });
            }}
            className={[
              "btn-primary",
              !canExcel ? "opacity-50 cursor-not-allowed" : "",
            ].join(" ")}
          >
            엑셀 다운로드
          </button>
        </div>
      </div>

      {/* Empty */}
      {rows.length === 0 && (
        <EmptyState
          title="급여 스냅샷이 없습니다"
          message="해당 기간에 월 마감이 아직 진행되지 않았거나, 생성된 스냅샷이 없습니다."
        />
      )}

      {/* Totals */}
      {rows.length > 0 && (
        <Card>
          <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Kpi label="총 근무시간" value={`${Math.round(totals.workHours * 100) / 100} h`} />
            <Kpi label="급여 합계" value={`${totals.workAmount.toLocaleString()}원`} />
            <Kpi label="승인 비용 합계" value={`${totals.expenseAmount.toLocaleString()}원`} />
            <Kpi
              label="실 지급액 합계"
              value={`${totals.totalAmount.toLocaleString()}원`}
              primary
            />
          </CardBody>
        </Card>
      )}

      {/* Table */}
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)]">
          <div className="grid grid-cols-[120px_120px_140px_140px_160px_140px] gap-4 px-4 py-3 text-xs font-semibold text-[var(--text-muted)] border-b bg-[var(--bg-surface-soft)]">
            <div>정산월</div>
            <div>근무시간</div>
            <div>급여</div>
            <div>승인비용</div>
            <div>실지급액</div>
            <div className="text-right">다운로드</div>
          </div>

          {rows
            .slice()
            .sort((a, b) => {
              const aa = a.year * 100 + a.month;
              const bb = b.year * 100 + b.month;
              return bb - aa;
            })
            .map((r) => {
              const label = ymLabel(r.year, r.month);

              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[120px_120px_140px_140px_160px_140px] gap-4 px-4 py-3 text-sm border-b last:border-b-0 items-center"
                >
                  <div className="font-semibold">{label}</div>

                  <div>{safeNumber(r.work_hours)} h</div>

                  <div>{safeNumber(r.work_amount).toLocaleString()}원</div>

                  <div>{safeNumber(r.approved_expense_amount).toLocaleString()}원</div>

                  <div className="font-semibold text-[var(--color-primary)]">
                    {safeNumber(r.total_amount).toLocaleString()}원
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => exportPayrollSnapshotPdf({ staff: sid, year: r.year, month: r.month })}
                      className="h-[32px] px-3 rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] text-xs font-semibold hover:bg-[var(--bg-surface-soft)]"
                      title="PDF 급여명세서 다운로드"
                    >
                      PDF
                    </button>

                    <button
                      onClick={() => exportPayrollSnapshotExcel({ year: r.year, month: r.month })}
                      className="h-[32px] px-3 rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] text-xs font-semibold hover:bg-[var(--bg-surface-soft)]"
                      title="엑셀(.xlsx) 다운로드"
                    >
                      XLSX
                    </button>
                  </div>

                  {(r.generated_by_name || r.created_at) && (
                    <div className="col-span-6 -mt-1 pb-3 text-[11px] text-[var(--text-muted)]">
                      {r.generated_by_name ? (
                        <>
                          생성자: <b>{r.generated_by_name}</b>
                        </>
                      ) : (
                        <>
                          생성자: <b>-</b>
                        </>
                      )}
                      <span className="mx-2 text-[var(--border-divider)]">|</span>
                      생성시각: <b>{r.created_at ? new Date(r.created_at).toLocaleString() : "-"}</b>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      <div className="text-xs text-[var(--text-muted)]">
        * 급여 스냅샷은 <b>월 마감</b> 시 생성되며, 이후 변경되지 않는 확정 데이터입니다.
      </div>
    </div>
  );
}

function Kpi({
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
