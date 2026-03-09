// PATH: src/features/students/components/TagAddModal.tsx
// 선택한 학생들에게 태그 일괄 부여

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTags, attachStudentTag } from "../api/students";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";

type TagAddModalProps = {
  open: boolean;
  onClose: () => void;
  studentIds: number[];
  onSuccess: () => void;
  adding: boolean;
  setAdding: (v: boolean) => void;
};

export default function TagAddModal({
  open,
  onClose,
  studentIds,
  onSuccess,
  adding,
  setAdding,
}: TagAddModalProps) {
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["students", "tags"],
    queryFn: getTags,
    enabled: open,
  });

  const handleSubmit = async () => {
    if (!selectedTagId || studentIds.length === 0) {
      feedback.info("태그를 선택해 주세요.");
      return;
    }
    setAdding(true);
    try {
      for (const id of studentIds) {
        await attachStudentTag(id, selectedTagId);
      }
      feedback.success(`${studentIds.length}명에게 태그를 추가했습니다.`);
      onSuccess();
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : "태그 추가에 실패했습니다.");
    } finally {
      setAdding(false);
    }
  };

  if (!open) return null;

  return (
    <AdminModal open={open} onClose={onClose} width={MODAL_WIDTH.sm}>
      <ModalHeader
        title="태그 추가"
        description={`선택한 ${studentIds.length}명에게 추가할 태그를 선택하세요.`}
      />
      <ModalBody>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)]">태그</label>
          <select
            className="ds-input w-full"
            value={selectedTagId ?? ""}
            onChange={(e) => setSelectedTagId(e.target.value ? Number(e.target.value) : null)}
            disabled={isLoading}
          >
            <option value="">태그 선택…</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {tags.length === 0 && !isLoading && (
            <p className="text-sm text-[var(--color-text-muted)]">등록된 태그가 없습니다. 학생 상세에서 태그를 먼저 만드세요.</p>
          )}
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button type="button" intent="secondary" size="md" onClick={onClose} disabled={adding}>
              취소
            </Button>
            <Button
              type="button"
              intent="primary"
              size="md"
              onClick={handleSubmit}
              disabled={adding || !selectedTagId || studentIds.length === 0}
              loading={adding}
            >
              {adding ? "추가 중…" : "태그 추가"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
