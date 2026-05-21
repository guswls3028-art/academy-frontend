/**
 * 알림 배지 컴포넌트 - 카톡 스타일 빨간 원형 배지
 *
 * 최적화:
 * - React.memo로 불필요한 리렌더링 방지
 * - 숫자 포맷팅 최적화
 */
import { memo } from "react";

import styles from "./NotificationBadge.module.css";

type Props = {
  count: number;
  max?: number;
};

function NotificationBadge({ count, max = 99 }: Props) {
  if (count <= 0) return null;

  const displayCount = count > max ? `${max}+` : String(count);

  return (
    <span className={styles.badge} aria-label={`${count}개의 알림`}>
      {displayCount}
    </span>
  );
}

export default memo(NotificationBadge);
