// PATH: src/shared/ui/ds/KPI.tsx
/**
 * ======================================================
 * KPI (SSOT)
 * - 관리자 홈/리포트에서 "숫자 카드"를 통일
 * - onClick 지정 시 키보드/마우스 인터랙션 활성 (cursor + hover + Enter/Space)
 * ======================================================
 */
export default function KPI({
  label,
  value,
  hint,
  onClick,
  ariaLabel,
}: {
  label: string;
  value: string | number;
  hint?: string;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const interactive = typeof onClick === "function";

  const inner = (
    <>
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
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? `${label} ${value}`}
        className="kpi ds-kpi ds-kpi--interactive"
        data-kpi="true"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          textAlign: "left",
          cursor: "pointer",
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border-divider)",
          borderRadius: 12,
          padding: 16,
          transition: "border-color 120ms ease, background 120ms ease",
          font: "inherit",
          color: "inherit",
        }}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="kpi ds-kpi" data-kpi="true">
      {inner}
    </div>
  );
}
