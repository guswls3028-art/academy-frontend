/**
 * ApplyBundleModal
 *
 * 템플릿 묶음을 선택하여 현재 차시에 일괄 적용.
 * 시험 + 과제가 한 번에 생성됨.
 */

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { fetchBundles, applyBundle, type TemplateBundle } from "../../api/templateBundles";

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: number;
  onApplied: (result: { examIds: number[]; homeworkIds: number[] }) => void;
};

export default function ApplyBundleModal({ open, onClose, sessionId, onApplied }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: bundles = [], isLoading } = useQuery({
    queryKey: ["template-bundles"],
    queryFn: fetchBundles,
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setError(null);
    setSubmitting(false);
  }, [open]);

  const selected = bundles.find((b) => b.id === selectedId) ?? null;

  const handleApply = async () => {
    if (!selectedId || !sessionId) return;

    setError(null);
    setSubmitting(true);
    try {
      const result = await applyBundle(selectedId, sessionId);
      const examIds = result.created_exams.map((e) => e.id);
      const hwIds = result.created_homeworks.map((h) => h.id);

      const skipped = (result as any).skipped_items?.length ?? 0;
      const msg = `묶음 적용 완료: 시험 ${result.created_exams.length}개, 과제 ${result.created_homeworks.length}개 생성` +
        (skipped > 0 ? ` (삭제된 템플릿 ${skipped}개 건너뜀)` : "");
      if (skipped > 0) feedback.warning(msg);
      else feedback.success(msg);
      onApplied({ examIds: examIds, homeworkIds: hwIds });
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "묶음 적용에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <AdminModal open onClose={onClose} type="action" width={MODAL_WIDTH.default}>
      <ModalHeader
        type="action"
        title="묶음 불러오기"
        description="저장된 시험/과제 묶음을 선택하여 이 차시에 일괄 적용합니다."
      />
      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact">
          {error && (
            <div className="modal-hint modal-hint--block" style={{ color: "var(--color-error)", fontWeight: 700 }}>
              {error}
            </div>
          )}

          {isLoading && (
            <div className="text-sm text-[var(--color-text-muted)] py-4 text-center">불러오는 중…</div>
          )}

          {!isLoading && bundles.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-[var(--color-text-muted)]">
              <Package size={28} />
              <div className="text-sm font-semibold">등록된 묶음이 없습니다</div>
              <div className="text-xs">시험 &gt; 묶음 관리에서 먼저 묶음을 만들어 주세요.</div>
            </div>
          )}

          {!isLoading && bundles.length > 0 && (
            <div className="modal-form-group">
              <label className="modal-section-label">묶음 선택</label>
              <div className="grid gap-2" style={{ maxHeight: 360, overflowY: "auto" }}>
                {bundles.map((bundle) => {
                  const active = bundle.id === selectedId;
                  return (
                    <button
                      key={bundle.id}
                      type="button"
                      onClick={() => setSelectedId(bundle.id)}
                      className={`w-full text-left rounded border px-4 py-3 transition-colors ${
                        active
                          ? "border-[var(--color-brand-primary)] bg-[var(--state-selected-bg)]"
                          : "border-[var(--color-border-divider)] hover:bg-[var(--color-bg-surface-soft)]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Package size={16} className="text-[var(--color-brand-primary)] flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                            {bundle.name}
                          </div>
                          <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                            시험 {bundle.exam_count}개 · 과제 {bundle.homework_count}개
                          </div>
                        </div>
                      </div>
                      {bundle.items.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5 ml-6">
                          {bundle.items.map((item) => (
                            <span
                              key={item.id}
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border border-[var(--color-border-divider)] text-[var(--color-text-secondary)] bg-[var(--color-bg-surface-soft)]"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${item.item_type === "exam" ? "bg-blue-500" : "bg-emerald-500"}`} />
                              {item.title_override || item.template_title || "-"}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button intent="secondary" size="xl" onClick={onClose} disabled={submitting}>
              취소
            </Button>
            <Button
              intent="primary"
              size="xl"
              onClick={handleApply}
              disabled={submitting || !selectedId || bundles.length === 0}
            >
              {submitting ? "적용 중…" : "묶음 적용"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
