// PATH: src/student/shared/ui/layout/EmptyState.tsx
/**
 * ✅ EmptyState (LOCK v3)
 * - 학생 앱 전역 빈 상태 컴포넌트
 * - 간결하고 예쁜 디자인
 * - 다크 모드 지원 (CSS 기반)
 * - 아이콘 옵션 지원
 */
type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  compact?: boolean; // 작은 크기 (카드 내부용)
};

export default function EmptyState({
  title,
  description,
  icon,
  compact = false,
}: EmptyStateProps) {

  // 기본 아이콘 (없으면 간단한 원형 아이콘)
  const defaultIcon = icon || (
    <div
      className="stu-emptystate__icon"
      style={{
        width: compact ? 48 : 64,
        height: compact ? 48 : 64,
        borderRadius: "50%",
        background: "var(--stu-surface-soft)",
        border: "1px solid var(--stu-border-subtle)",
        display: "grid",
        placeItems: "center",
        margin: "0 auto",
        opacity: 0.6,
      }}
    >
      <svg
        className="stu-emptystate__icon-svg"
        width={compact ? 24 : 32}
        height={compact ? 24 : 32}
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
        padding: compact ? "var(--stu-space-5)" : "var(--stu-space-8)",
        textAlign: "center",
        minHeight: compact ? "auto" : 200,
      }}
    >
      {/* 아이콘 */}
      <div style={{ marginBottom: compact ? "var(--stu-space-3)" : "var(--stu-space-4)" }}>
        {defaultIcon}
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
            lineHeight: 1.5,
            maxWidth: compact ? "100%" : 400,
            margin: 0,
          }}
        >
          {description}
        </p>
      )}
    </div>
  );
}
