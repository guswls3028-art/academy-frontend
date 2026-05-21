// PATH: src/app_student/layout/EmptyState.tsx
/**
 * EmptyState (v4)
 * - 학생 앱 전역 빈 상태 컴포넌트
 * - 큰 원형 gradient 배경 + 아이콘
 * - 미래지향적 톤 (곧 여기에 표시돼요)
 * - 다크 모드 지원 (CSS 기반)
 * - 아이콘 옵션 지원
 */
import type { ReactNode } from "react";

import styles from "./EmptyState.module.css";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  compact?: boolean; // 작은 크기 (카드 내부용)
  onRetry?: () => void; // 재시도 콜백 (에러 상태에서 사용)
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function EmptyState({
  title,
  description,
  icon,
  compact = false,
  onRetry,
}: EmptyStateProps) {
  const rootClassName = cx(styles.root, compact && styles.compact);
  const iconClassName = cx("stu-emptystate__icon", styles.iconFrame);

  const renderedIcon = (
    <div className={iconClassName}>
      {icon ?? (
        <svg
          className={cx("stu-emptystate__icon-svg", styles.iconSvg)}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--stu-text-muted)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      )}
    </div>
  );

  return (
    <div className={rootClassName}>
      <div className={styles.iconSlot}>{renderedIcon}</div>

      <h3
        className={cx(
          "stu-emptystate__title",
          styles.title,
          description && styles.titleWithDescription
        )}
      >
        {title}
      </h3>

      {description && (
        <p className={cx("stu-emptystate__description", styles.description)}>
          {description}
        </p>
      )}

      {onRetry && (
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}
