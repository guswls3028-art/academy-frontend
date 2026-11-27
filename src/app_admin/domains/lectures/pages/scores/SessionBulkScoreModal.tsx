import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";

type Props = {
  selectedCount: number;
  bulkScoreTarget: "exam" | "homework";
  setBulkScoreTarget: (target: "exam" | "homework") => void;
  bulkScoreValue: string;
  setBulkScoreValue: (value: string) => void;
  applyBulkScore: () => void;
  onClose: () => void;
};

export default function SessionBulkScoreModal({
  selectedCount, bulkScoreTarget, setBulkScoreTarget, bulkScoreValue, setBulkScoreValue, applyBulkScore, onClose,
}: Props) {
  return (
    <AdminModal
      open
      onClose={onClose}
      type="action"
      size="sm"
      onEnterConfirm={() => {
        if (!bulkScoreValue.trim()) return;
        applyBulkScore();
      }}
    >
      <ModalHeader title="성적 일괄 변경" />
      <ModalBody>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            선택한 {selectedCount}명의 성적을 일괄 변경합니다.
          </p>
          <div>
            <label className="text-sm font-medium text-[var(--color-text-primary)] mb-1 block">대상</label>
            <div className="flex gap-2">
              <button
                type="button"
                className={`h-9 px-4 rounded text-sm font-medium border ${
                  bulkScoreTarget === "exam"
                    ? "bg-[var(--color-brand-primary)] text-[color:var(--color-brand-primary-contrast)] border-[var(--color-brand-primary)]"
                    : "bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border-divider)]"
                }`}
                onClick={() => setBulkScoreTarget("exam")}
              >
                시험
              </button>
              <button
                type="button"
                className={`h-9 px-4 rounded text-sm font-medium border ${
                  bulkScoreTarget === "homework"
                    ? "bg-[var(--color-brand-primary)] text-[color:var(--color-brand-primary-contrast)] border-[var(--color-brand-primary)]"
                    : "bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border-divider)]"
                }`}
                onClick={() => setBulkScoreTarget("homework")}
              >
                과제
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--color-text-primary)] mb-1 block" htmlFor="bulk-score-input">
              점수
            </label>
            <input
              id="bulk-score-input"
              type="number"
              min={0}
              className="ds-input max-w-[200px]"
              placeholder="점수를 입력하세요"
              value={bulkScoreValue}
              onChange={(e) => setBulkScoreValue(e.target.value)}
              autoFocus
            />
          </div>
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button
              intent="secondary"
              size="sm"
              onClick={onClose}
            >
              취소
            </Button>
            <Button
              intent="primary"
              size="sm"
              disabled={!bulkScoreValue.trim()}
              onClick={applyBulkScore}
            >
              적용
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
