// PATH: src/features/staff/components/PayrollSummaryCard.tsx
// 급여 KPI 배너 — 총 근무시간, 기본급, 실지급액을 한눈에 보여주는 상단 카드

import { useQuery } from "@tanstack/react-query";
import { fetchStaffSummaryByRange } from "../api/staff.detail.api";
import { useWorkMonth } from "../operations/context/WorkMonthContext";

const TAX_RATE = 0.033;

function KpiBox({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 140,
        padding: "16px 20px",
        borderRadius: "var(--radius-lg)",
        background: accent
          ? "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 80%, #000))"
          : "var(--color-bg-surface)",
        border: accent ? "none" : "1px solid var(--color-border-divider)",
        color: accent ? "#fff" : "var(--color-text-primary)",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, opacity: accent ? 0.85 : 0.6, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, marginTop: 4, opacity: accent ? 0.75 : 0.5 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--color-border-divider)" }}>
      <span style={{ fontSize: 13, color: muted ? "var(--color-text-muted)" : "var(--color-text-secondary)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: muted ? "var(--color-text-muted)" : "var(--color-text-primary)" }}>{value}</span>
    </div>
  );
}

export function PayrollSummaryCard() {
  const { staffId, range, year, month } = useWorkMonth();

  const summaryQ = useQuery({
    queryKey: ["staff-summary", staffId, range.from, range.to],
    queryFn: () => fetchStaffSummaryByRange(staffId, range.from, range.to),
    enabled: !!staffId && !!range.from && !!range.to,
  });

  const s = summaryQ.data;
  if (summaryQ.isLoading || !s) {
    return (
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ flex: "1 1 0", minWidth: 140, height: 90, borderRadius: "var(--radius-lg)", background: "var(--color-bg-surface-soft)", animation: "pulse 1.5s infinite" }} />
        ))}
      </div>
    );
  }

  const workHours = Number(s.work_hours) || 0;
  const baseWage = Number(s.work_amount) || 0;
  const allowance = Number(s.expense_amount) || 0;
  const grossPay = baseWage + allowance;
  const tax = Math.floor(grossPay * TAX_RATE);
  const netPay = grossPay - tax;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* KPI 대형 카드 3개 */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KpiBox
          label="총 근무시간"
          value={`${workHours.toFixed(1)}h`}
          sub={`${year}년 ${month}월`}
        />
        <KpiBox
          label="기본급"
          value={`${baseWage.toLocaleString()}원`}
          sub={allowance > 0 ? `+ 경비 ${allowance.toLocaleString()}원` : undefined}
        />
        <KpiBox
          label="실지급액"
          value={`${netPay.toLocaleString()}원`}
          sub={`세금 3.3% 공제 후`}
          accent
        />
      </div>

      {/* 상세 내역 (접이식) */}
      <details style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border-divider)", background: "var(--color-bg-surface)", overflow: "hidden" }}>
        <summary style={{ padding: "10px 16px", fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", cursor: "pointer", userSelect: "none" }}>
          급여 상세 내역
        </summary>
        <div style={{ padding: "4px 16px 12px" }}>
          <DetailRow label="총 근무시간" value={`${workHours.toFixed(1)} h`} />
          <DetailRow label="기본급 (근무)" value={`${baseWage.toLocaleString()}원`} />
          <DetailRow label="수당 · 경비" value={`${allowance.toLocaleString()}원`} />
          <DetailRow label="총 지급액" value={`${grossPay.toLocaleString()}원`} />
          <DetailRow label="세금 (3.3%)" value={`-${tax.toLocaleString()}원`} muted />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0 0", marginTop: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)" }}>실지급액</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: "var(--color-primary)", fontVariantNumeric: "tabular-nums" }}>{netPay.toLocaleString()}원</span>
          </div>
        </div>
      </details>
    </div>
  );
}
