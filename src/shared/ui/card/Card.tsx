// PATH: src/shared/ui/card/Card.tsx
/**
 * Card
 *
 * ✅ 전역 공용 카드 컨테이너
 * - 배경 / 테두리 / 라운드 / 텍스트 색상은 CSS Variable 단일 진실
 * - theme 변경 시 자동 반영
 *
 * ❌ 레이아웃 책임 없음
 * ❌ padding 강제 없음 (Body가 담당)
 */

export default function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "card", // ← styles/components.css 기준
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
