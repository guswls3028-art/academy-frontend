/**
 * GateNotice
 *
 * WHY:
 * - 기능 비활성은 "숨김"이 아니라 "이유 설명"이 원칙
 * - session / asset / lock 게이트를 공통 UX로 표현
 * - exams / homework 형제 도메인에서 동일 패턴 사용 가능
 */

type GateNoticeProps = {
  title: string;
  description: string;
  checklist?: string[];
  cta?: {
    label: string;
    onClick: () => void;
  };
};

export default function GateNotice({
  title,
  description,
  checklist,
  cta,
}: GateNoticeProps) {
  return (
    <div className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] p-5 space-y-3">
      <div className="text-base font-semibold text-[var(--text-primary)]">
        {title}
      </div>

      <div className="text-sm text-[var(--text-secondary)]">
        {description}
      </div>

      {checklist && checklist.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-[var(--text-secondary)] space-y-1">
          {checklist.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      )}

      {cta && (
        <div className="pt-2">
          <button
            type="button"
            onClick={cta.onClick}
            className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            {cta.label}
          </button>
        </div>
      )}
    </div>
  );
}
