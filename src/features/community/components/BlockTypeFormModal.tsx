// PATH: src/features/community/components/BlockTypeFormModal.tsx
// 블록 유형 추가/수정 모달 — 게시관리·설정 양쪽에서 사용

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createBlockType,
  updateBlockType,
  type BlockType,
} from "../api/community.api";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";

export interface BlockTypeFormModalProps {
  edit?: BlockType;
  onClose: () => void;
  onSuccess: () => void;
  /** 추가 시 생성된 유형 전달 (게시관리에서 즉시 선택용) */
  onSuccessWithCreated?: (block: BlockType) => void;
}

export default function BlockTypeFormModal({
  edit,
  onClose,
  onSuccess,
  onSuccessWithCreated,
}: BlockTypeFormModalProps) {
  const [label, setLabel] = useState(edit?.label ?? "");
  const [order, setOrder] = useState(edit?.order ?? 100);
  const qc = useQueryClient();

  const createMut = useMutation({
    mutationFn: () => createBlockType({ label: label.trim(), order }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["community-block-types"] });
      onSuccess();
      onSuccessWithCreated?.(data);
    },
  });
  const updateMut = useMutation({
    mutationFn: () =>
      updateBlockType(edit!.id, { label: label.trim(), order }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-block-types"] });
      onSuccess();
    },
  });

  const handleSubmit = () => {
    if (!label.trim()) return;
    if (edit) updateMut.mutate();
    else createMut.mutate();
  };

  const pending = createMut.isPending || updateMut.isPending;

  return (
    <AdminModal open onClose={onClose} type="action" width={420}>
      <ModalHeader
        type="action"
        title={edit ? "유형 수정" : "유형 추가"}
        description={edit ? "표시명과 순서를 수정합니다." : "글 작성 시 선택할 유형을 추가합니다."}
      />
      <ModalBody>
        <div style={{ marginBottom: 12 }}>
          <label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-1">
            표시명
          </label>
          <input
            className="ds-input w-full"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="예: 시험 공지"
            disabled={pending}
          />
        </div>
        <div style={{ marginBottom: 0 }}>
          <label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-1">
            정렬 순서 (작을수록 앞에 표시)
          </label>
          <input
            type="number"
            className="ds-input w-full"
            value={order}
            onChange={(e) => setOrder(Number(e.target.value) || 0)}
            min={0}
            disabled={pending}
          />
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button intent="secondary" size="sm" onClick={onClose} disabled={pending}>
              취소
            </Button>
            <Button
              intent="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={!label.trim() || pending}
            >
              {edit ? (updateMut.isPending ? "저장 중…" : "저장") : createMut.isPending ? "추가 중…" : "추가"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
