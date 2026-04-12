/**
 * SectionHeader
 *
 * WHY:
 * - 시험/과제 공통 섹션 타이포 계층 통일
 * - "큰 제목 + 한 줄 요약" 패턴 고정
 */

export default function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-base font-semibold text-[var(--text-primary)]">
        {title}
      </div>
      {description && (
        <div className="text-xs text-[var(--text-muted)]">
          {description}
        </div>
      )}
    </div>
  );
}
