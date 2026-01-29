// PATH: src/shared/ui/card/CardHeader.tsx
/**
 * CardHeader
 *
 * 책임:
 * - 카드 상단 제목 / 액션 영역
 * - border / spacing 표준화
 *
 * 규칙:
 * - title 없으면 header 렌더 ❌
 */

export default function CardHeader({
  title,
  actions,
}: {
  title?: string;
  actions?: React.ReactNode;
}) {
  if (!title && !actions) return null;

  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      {title && (
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          {title}
        </h3>
      )}

      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
