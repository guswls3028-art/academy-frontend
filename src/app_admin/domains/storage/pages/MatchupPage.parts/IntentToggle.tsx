// PATH: src/app_admin/domains/storage/pages/MatchupPage.parts/IntentToggle.tsx
// 시험지 ↔ 참고자료 segmented 토글.
// 뱃지 + 변경 버튼 2개로 쪼개졌던 컨트롤을 한 곳으로 통합. 현재 상태와 변경 동작을
// 한 컨트롤로 합쳐 학원장이 "지금 어느 쪽인지" 즉시 인지 + 한 번 클릭으로 전환.
//
// 인라인 스타일은 active/inactive 동적 색상·boxShadow 분기 때문에 의도적 사용.
/* eslint-disable no-restricted-syntax */

export default function IntentToggle({
  value,
  onChange,
  disabled,
}: {
  value: "test" | "reference";
  onChange: (next: "test" | "reference") => void;
  disabled: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="문서 유형"
      data-testid="matchup-intent-toggle"
      style={{
        display: "inline-flex",
        padding: 2,
        borderRadius: 999,
        background: "var(--color-bg-surface-soft)",
        border: "1px solid var(--color-border-divider)",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {(["test", "reference"] as const).map((key) => {
        const active = value === key;
        const label = key === "test" ? "시험지" : "참고자료";
        const tone = key === "test" ? "var(--color-warning)" : "var(--color-brand-primary)";
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled || active}
            onClick={() => onChange(key)}
            data-active={active}
            data-testid={`matchup-intent-toggle-${key}`}
            style={{
              padding: "3px 12px",
              border: "none",
              borderRadius: 999,
              background: active ? "var(--color-bg-surface)" : "transparent",
              color: active ? tone : "var(--color-text-muted)",
              fontWeight: active ? 700 : 500,
              fontSize: 12,
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              cursor: disabled || active ? "default" : "pointer",
              transition: "background 0.12s, color 0.12s",
            }}
            title={active ? `현재 ${label}` : `${label}로 변경`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
