// PATH: src/student/shared/ui/layout/EmptyState.tsx
/**
 * ✅ EmptyState (LOCK v2)
 * - base.css 디자인 시스템 흡수
 * - inline style 제거
 * - 테마 변경 시 자동 반응
 */

export default function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="stu-section stu-section--nested">
      <div className="stu-stack" style={{ gap: "var(--stu-space-4)" }}>
        <div className="stu-h3">{title}</div>
        {description && <div className="stu-muted">{description}</div>}
      </div>
    </div>
  );
}
