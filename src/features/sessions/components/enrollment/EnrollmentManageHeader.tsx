// PATH: src/features/sessions/components/enrollment/EnrollmentManageHeader.tsx

export default function EnrollmentManageHeader({
  title,
  description,
  onClose,
}: {
  title: string;
  description?: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border-divider)] px-5 py-4">
      <div>
        <div className="text-base font-semibold text-[var(--text-primary)]">
          {title}
        </div>
        {description && (
          <div className="mt-1 text-xs text-[var(--text-secondary)]">
            {description}
          </div>
        )}
      </div>

      <button
        type="button"
        className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        onClick={onClose}
      >
        닫기
      </button>
    </div>
  );
}
