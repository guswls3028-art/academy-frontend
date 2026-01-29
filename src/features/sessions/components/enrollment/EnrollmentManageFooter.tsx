// PATH: src/features/sessions/components/enrollment/EnrollmentManageFooter.tsx

export default function EnrollmentManageFooter({
  readOnly,
  onClose,
  onSave,
  saving,
  dirty,
}: {
  readOnly: boolean;
  onClose: () => void;
  onSave?: () => void;
  saving?: boolean;
  dirty?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-t border-[var(--border-divider)] px-5 py-4">
      <div className="text-xs text-[var(--text-muted)]">
        {readOnly
          ? "조회 전용"
          : dirty
          ? "변경사항이 있습니다. 저장하면 확정됩니다."
          : "변경사항 없음"}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="h-9 rounded border border-[var(--border-divider)] px-4 text-sm hover:bg-[var(--bg-surface-soft)]"
          onClick={onClose}
          disabled={saving}
        >
          취소
        </button>

        {!readOnly && (
          <button
            type="button"
            className="h-9 rounded bg-[var(--color-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? "저장중..." : "선택 확정(저장)"}
          </button>
        )}
      </div>
    </div>
  );
}
