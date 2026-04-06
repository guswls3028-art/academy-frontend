// PATH: src/features/exams/components/create/CreateTemplateExamModal.tsx
// 시험 템플릿 일괄 생성 모달

import { useEffect, useState } from "react";
import { createTemplateExam } from "../../api/exams";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";

type BulkRow = {
  id: number;
  title: string;
  subject: string;
};

let rowIdCounter = 0;
function makeRow(): BulkRow {
  return {
    id: ++rowIdCounter,
    title: "",
    subject: "",
  };
}

export default function CreateTemplateExamModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (examId: number) => void;
}) {
  const [rows, setRows] = useState<BulkRow[]>(() => [makeRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (!open) return;
    setRows([makeRow()]);
    setSubmitting(false);
    setError(null);
  }, [open]);

  // ── Row helpers ──
  const addRow = () => setRows((prev) => [...prev, makeRow()]);

  const removeRow = (rowId: number) =>
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== rowId)));

  const updateRow = (rowId: number, field: keyof Omit<BulkRow, "id">, value: string) =>
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)));

  // ── Bulk submit ──
  const handleBulkSubmit = async () => {
    const validRows = rows.filter((r) => r.title.trim());
    if (validRows.length === 0) {
      setError("시험 제목을 하나 이상 입력하세요.");
      return;
    }

    setError(null);
    setSubmitting(true);

    const createdIds: number[] = [];
    const failedTitles: string[] = [];

    for (const row of validRows) {
      try {
        const exam = await createTemplateExam({
          title: row.title.trim(),
          subject: row.subject.trim(),
        });

        const safeId =
          Number(exam?.id) ||
          Number((exam as any)?.exam_id) ||
          0;

        if (!safeId) throw new Error("생성 후 ID를 받지 못했습니다.");
        createdIds.push(safeId);
      } catch {
        failedTitles.push(row.title.trim());
      }
    }

    setSubmitting(false);

    // onCreated — 마지막 생성된 템플릿으로 네비게이션
    if (createdIds.length > 0) {
      onCreated(createdIds[createdIds.length - 1]);
    }

    if (failedTitles.length === 0) {
      feedback.success(`${createdIds.length}개 템플릿 일괄 생성 완료`);
      onClose();
    } else if (createdIds.length > 0) {
      feedback.warning(
        `${createdIds.length}개 생성 완료, ${failedTitles.length}개 실패: ${failedTitles.join(", ")}`
      );
      onClose();
    } else {
      setError(`템플릿 생성 실패: ${failedTitles.join(", ")}`);
    }
  };

  if (!open) return null;

  const bulkHasAnyTitle = rows.some((r) => r.title.trim());
  const validCount = rows.filter((r) => r.title.trim()).length;

  return (
    <AdminModal
      open
      onClose={onClose}
      type="action"
      width={MODAL_WIDTH.default}
      onEnterConfirm={bulkHasAnyTitle && !submitting ? handleBulkSubmit : undefined}
    >
      <ModalHeader
        type="action"
        title="시험 템플릿 생성"
        description="여러 템플릿을 한번에 생성할 수 있습니다. 행을 추가한 뒤 일괄 생성하세요."
      />

      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact">
          {error && (
            <div className="modal-hint modal-hint--block" style={{ color: "var(--color-error)", fontWeight: 700 }}>
              {error}
            </div>
          )}

          <div className="modal-form-group">
            <table className="ds-table w-full" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col />
                <col style={{ width: 110 }} />
                <col style={{ width: 40 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="text-left text-xs font-semibold" style={{ padding: "6px 8px" }}>제목</th>
                  <th className="text-left text-xs font-semibold" style={{ padding: "6px 8px" }}>과목</th>
                  <th style={{ padding: "6px 8px" }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id}>
                    <td style={{ padding: "4px 8px" }}>
                      <input
                        className="ds-input w-full"
                        value={row.title}
                        onChange={(e) => updateRow(row.id, "title", e.target.value)}
                        placeholder={`템플릿 ${idx + 1}`}
                        autoFocus={idx === 0}
                        aria-label={`템플릿 ${idx + 1} 제목`}
                      />
                    </td>
                    <td style={{ padding: "4px 8px" }}>
                      <input
                        className="ds-input w-full"
                        value={row.subject}
                        onChange={(e) => updateRow(row.id, "subject", e.target.value)}
                        placeholder="과목"
                        aria-label={`템플릿 ${idx + 1} 과목`}
                      />
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length <= 1}
                        className="text-lg leading-none text-[var(--color-text-muted)] hover:text-[var(--color-error)] disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="행 삭제"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Add row button */}
            <button
              type="button"
              onClick={addRow}
              className="mt-2 w-full rounded border border-dashed border-[var(--color-border-divider)] py-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] hover:border-[var(--color-brand-primary)] transition-colors"
            >
              + 추가
            </button>
          </div>
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
              onClick={handleBulkSubmit}
              disabled={submitting || !bulkHasAnyTitle}
            >
              {submitting
                ? "생성 중…"
                : `일괄 생성${validCount > 1 ? ` (${validCount}개)` : ""}`}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
