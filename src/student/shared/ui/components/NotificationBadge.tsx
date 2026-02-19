/**
 * 알림 배지 컴포넌트 — 카톡 스타일 빨간 원형 배지
 * 
 * 최적화:
 * - React.memo로 불필요한 리렌더링 방지
 * - 숫자 포맷팅 최적화
 */
import { memo } from "react";

type Props = {
  count: number;
  max?: number;
};

function NotificationBadge({ count, max = 99 }: Props) {
  if (count <= 0) return null;

  const displayCount = count > max ? `${max}+` : String(count);

  return (
    <span
      style={{
        position: "absolute",
        top: -2,
        right: -2,
        minWidth: 18,
        height: 18,
        padding: "0 6px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ef4444",
        color: "#ffffff",
        borderRadius: 9,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
        border: "2px solid var(--stu-tabbar-bg, var(--stu-bg))",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
        zIndex: 10,
      }}
      aria-label={`${count}개의 알림`}
    >
      {displayCount}
    </span>
  );
}

export default memo(NotificationBadge);
