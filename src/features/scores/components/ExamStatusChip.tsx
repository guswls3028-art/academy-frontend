// PATH: src/features/scores/components/ExamStatusChip.tsx
/**
 * ExamStatusChip
 * - 우측 영수증 상단용 상태 요약
 * - (변경) 클릭 가능 옵션 지원 (시험/과제 칩 선택 → 테이블 컬럼 전환)
 */

type Props = {
  label: string;
  passed: boolean | null;

  /** optional: 클릭 가능 */
  onClick?: () => void;

  /** optional: 현재 선택 상태 강조 */
  active?: boolean;
};

export default function ExamStatusChip({
  label,
  passed,
  onClick,
  active,
}: Props) {
  const clickable = typeof onClick === "function";

  const base = [
    "rounded px-2 py-1 text-xs",
    clickable ? "cursor-pointer select-none" : "",
    active ? "ring-2 ring-[var(--color-primary)] ring-offset-1" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (passed === null) {
    return (
      <div
        className={[
          base,
          "border border-gray-300 bg-white text-gray-500",
        ].join(" ")}
        onClick={onClick}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={(e) => {
          if (!clickable) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          }
        }}
        title={clickable ? "클릭하여 컬럼 전환" : undefined}
      >
        {label}
      </div>
    );
  }

  return passed ? (
    <div
      className={[
        base,
        "bg-emerald-100 font-semibold text-emerald-700",
      ].join(" ")}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (!clickable) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      title={clickable ? "클릭하여 컬럼 전환" : undefined}
    >
      {label}
    </div>
  ) : (
    <div
      className={[
        base,
        "bg-red-100 font-semibold text-red-700",
      ].join(" ")}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (!clickable) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      title={clickable ? "클릭하여 컬럼 전환" : undefined}
    >
      {label}
    </div>
  );
}
