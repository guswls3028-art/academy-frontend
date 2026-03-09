// PATH: src/features/sessions/components/enrollment/EnrollmentManageFooter.tsx

import { Button } from "@/shared/ui/ds";

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
        <Button
          type="button"
          intent="secondary"
          size="sm"
          onClick={onClose}
          disabled={saving}
        >
          취소
        </Button>

        {!readOnly && (
          <Button
            type="button"
            intent="primary"
            size="sm"
            onClick={onSave}
            disabled={saving}
            loading={saving}
          >
            선택 확정(저장)
          </Button>
        )}
      </div>
    </div>
  );
}
