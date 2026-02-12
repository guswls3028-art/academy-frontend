// PATH: src/shared/ui/ds/KPI.tsx
/**
 * ======================================================
 * KPI (SSOT)
 * - 관리자 홈/리포트에서 "숫자 카드"를 통일
 * ======================================================
 */
export default function KPI({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="kpi ds-kpi" data-kpi="true">
      <div
        className="kpi-label"
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--color-text-muted)",
          fontWeight: "var(--font-title)",
        }}
      >
        {label}
      </div>

      <div
        className="kpi-value"
        style={{
          marginTop: 6,
          fontSize: "var(--text-2xl)",
          fontWeight: 700,
          letterSpacing: "-0.4px",
          color: "var(--color-text-primary)",
        }}
      >
        {value}
      </div>

      {hint && (
        <div
          style={{
            marginTop: 8,
            fontSize: "var(--text-sm)",
            fontWeight: "var(--font-meta)",
            color: "var(--color-text-secondary)",
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
