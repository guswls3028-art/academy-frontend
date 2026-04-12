// PATH: src/app_student/layout/EmptyState.tsx
/**
 * EmptyState (v4)
 * - 학생 앱 전역 빈 상태 컴포넌트
 * - 큰 원형 gradient 배경 + 아이콘
 * - 미래지향적 톤 (곧 여기에 표시돼요)
 * - 다크 모드 지원 (CSS 기반)
 * - 아이콘 옵션 지원
 */
type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  compact?: boolean; // 작은 크기 (카드 내부용)
  onRetry?: () => void; // 재시도 콜백 (에러 상태에서 사용)
};

export default function EmptyState({
  title,
  description,
  icon,
  compact = false,
  onRetry,
}: EmptyStateProps) {
  const iconSize = compact ? 52 : 72;
  const svgSize = compact ? 26 : 34;

  // 기본 아이콘: 큰 원형 gradient 배경 + 아이콘
  const renderedIcon = icon ? (
    <div
      style={{
        width: iconSize,
        height: iconSize,
        borderRadius: "50%",
        background: "linear-gradient(135deg, var(--stu-tint-primary), var(--stu-surface-soft))",
        border: "1px solid var(--stu-border-subtle)",
        display: "grid",
        placeItems: "center",
        margin: "0 auto",
      }}
    >
      {icon}
    </div>
  ) : (
    <div
      className="stu-emptystate__icon"
      style={{
        width: iconSize,
        height: iconSize,
        borderRadius: "50%",
        background: "linear-gradient(135deg, var(--stu-tint-primary), var(--stu-surface-soft))",
        border: "1px solid var(--stu-border-subtle)",
        display: "grid",
        placeItems: "center",
        margin: "0 auto",
      }}
    >
      <svg
        className="stu-emptystate__icon-svg"
        width={svgSize}
        height={svgSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--stu-text-muted)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 12h6M9 16h6M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
      </svg>
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: compact ? "var(--stu-space-5)" : "var(--stu-space-10, 48px)",
        textAlign: "center",
        minHeight: compact ? "auto" : 220,
      }}
    >
      {/* 아이콘 */}
      <div style={{ marginBottom: compact ? "var(--stu-space-3)" : "var(--stu-space-5)" }}>
        {renderedIcon}
      </div>

      {/* 제목 */}
      <h3
        className="stu-emptystate__title"
        style={{
          fontSize: compact ? 15 : 17,
          fontWeight: 600,
          color: "var(--stu-text)",
          marginBottom: description ? (compact ? "var(--stu-space-2)" : "var(--stu-space-3)") : 0,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h3>

      {/* 설명 */}
      {description && (
        <p
          className="stu-emptystate__description"
          style={{
            fontSize: compact ? 13 : 14,
            color: "var(--stu-text-muted)",
            lineHeight: 1.6,
            maxWidth: compact ? "100%" : 320,
            margin: 0,
          }}
        >
          {description}
        </p>
      )}

      {/* 재시도 버튼 */}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: compact ? "var(--stu-space-3)" : "var(--stu-space-5)",
            padding: "10px 24px",
            minHeight: 44,
            borderRadius: "var(--stu-radius-md)",
            border: "1.5px solid var(--stu-border)",
            background: "var(--stu-surface)",
            color: "var(--stu-text)",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            transition: "background var(--stu-motion-fast), border-color var(--stu-motion-fast)",
          }}
        >
          다시 시도
        </button>
      )}
    </div>
  );
}
