// PATH: src/app_admin/domains/submissions/components/DiscardReasonModal.tsx
/**
 * 답안지 폐기 사유 선택 모달.
 * - 단건/일괄 모두 사용. 사유 enum 은 backend submission_view._DISCARD_REASONS 와 동기.
 * - 운영자 audit 품질 향상 + 향후 사유 통계 (스캔 품질 X% / 오업로드 Y% ...) 가능.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/shared/ui/ds";
import type { DiscardReason } from "@admin/domains/materials/sheets/components/submissions/submissions.api";

const REASONS: { value: DiscardReason; label: string; desc: string }[] = [
  { value: "scan_quality", label: "스캔/사진 품질 불량", desc: "흐림, 반사, 잘림 등으로 인식 불가" },
  { value: "wrong_upload", label: "오업로드", desc: "다른 시험/학생/파일을 잘못 올림" },
  { value: "duplicate", label: "중복 업로드", desc: "이미 같은 답안이 매칭됨" },
  { value: "target_missing", label: "원본 시험/과제 없음", desc: "원본이 삭제되었거나 매칭 불가" },
  { value: "operator_discarded", label: "기타 운영자 폐기", desc: "위 사유에 해당하지 않음" },
];

type Props = {
  open: boolean;
  count: number; // 폐기 대상 개수 (1 이상)
  defaultReason?: DiscardReason;
  onClose: () => void;
  onConfirm: (reason: DiscardReason) => void;
};

export default function DiscardReasonModal({ open, count, defaultReason, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState<DiscardReason>(defaultReason ?? "operator_discarded");

  useEffect(() => {
    if (open) setReason(defaultReason ?? "operator_discarded");
  }, [open, defaultReason]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const titleText = count > 1 ? `${count}건 폐기` : "이 답안지 폐기";

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="답안지 폐기 사유"
        className="w-[480px] max-w-[92vw] rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-divider)] shadow-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[var(--color-border-divider)]">
          <div className="text-base font-bold text-[var(--color-text-primary)]">{titleText}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
            폐기하면 채점 대상에서 제외되고 실패 상태로 보존됩니다. 다시 채점하려면 새로 업로드해야 합니다.
          </div>
        </div>

        <div className="px-5 py-3 max-h-[55vh] overflow-y-auto">
          <div className="text-xs font-bold text-[var(--color-text-muted)] mb-2">폐기 사유</div>
          <div className="flex flex-col gap-1.5">
            {REASONS.map((r) => (
              <label
                key={r.value}
                className="flex items-start gap-2.5 px-3 py-2 rounded-lg cursor-pointer border border-transparent hover:border-[var(--color-border-divider)] hover:bg-[var(--color-bg-surface-soft)]"
              >
                <input
                  type="radio"
                  name="discard-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="mt-0.5"
                />
                <span className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{r.label}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{r.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[var(--color-border-divider)] flex items-center justify-end gap-2">
          <Button type="button" intent="secondary" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button type="button" intent="danger" size="sm" onClick={() => onConfirm(reason)}>
            {count > 1 ? `${count}건 폐기` : "폐기"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
