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
      >
        {label}
      </div>

      <div
        className="kpi-value"
      >
        {value}
      </div>

      {hint && (
        <div className="kpi-hint">
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
