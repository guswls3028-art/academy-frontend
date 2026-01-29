/**
 * InfoBanner
 *
 * WHY:
 * - 단순 경고/안내를 카드형으로 통일
 * - results / submissions / setup 전반에서 재사용
 */

export default function InfoBanner({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] p-3 text-sm text-[var(--text-secondary)]">
      {children}
    </div>
  );
}
