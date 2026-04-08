// PATH: src/features/students/components/TagAddModal.tsx
// 선택한 학생들에게 태그 일괄 부여 + 인라인 태그 생성

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTags, attachStudentTag } from "../api/students";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import TagCreateModal from "./TagCreateModal";
import { resolveTenantCodeString } from "@/shared/tenant";

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
  const qc = useQueryClient();
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const tenantCode = resolveTenantCodeString();
  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["students", "tags", tenantCode],
    queryFn: getTags,
    enabled: open,
  });

  // 모달 열릴 때 선택 초기화
  useEffect(() => {
    if (open) setSelectedTagId(null);
  }, [open]);

  const handleSubmit = async () => {
    if (!selectedTagId || studentIds.length === 0) {
      feedback.info("태그를 선택해 주세요.");
      return;
    }
    setAdding(true);
    let ok = 0;
    let fail = 0;
    const failNames: string[] = [];
    try {
      for (const id of studentIds) {
        try {
          await attachStudentTag(id, selectedTagId);
          ok++;
        } catch {
          fail++;
          failNames.push(String(id));
        }
      }
      if (ok > 0) {
        feedback.success(`${ok}명에게 태그를 추가했습니다.${fail > 0 ? ` (${fail}건 실패)` : ""}`);
        onSuccess();
      } else {
        feedback.error(`태그 추가 실패: ${failNames.join(", ")}`);
      }
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : "태그 추가에 실패했습니다.");
    } finally {
      setAdding(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <AdminModal open={open} onClose={onClose} width={MODAL_WIDTH.sm}>
        <ModalHeader
          title="태그 추가"
          description={`선택한 ${studentIds.length}명에게 추가할 태그를 선택하세요.`}
        />
        <ModalBody>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">태그</label>
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
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary-hover)] transition-colors"
              onClick={() => setShowCreate(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              새 태그 만들기
            </button>
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

      <TagCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        usedColors={tags.map((t) => t.color).filter(Boolean)}
        onSuccess={(tag) => {
          qc.invalidateQueries({ queryKey: ["students", "tags"] });
          setSelectedTagId(tag.id);
          setShowCreate(false);
        }}
      />
    </>
  );
}
