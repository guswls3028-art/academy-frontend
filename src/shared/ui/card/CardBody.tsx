// PATH: src/shared/ui/card/CardBody.tsx
/**
 * CardBody
 *
 * 책임:
 * - 카드 내부 padding 표준
 * - 콘텐츠 영역만 담당
 */

export default function CardBody({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "p-4", // ✅ 전역 카드 padding 기준
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
