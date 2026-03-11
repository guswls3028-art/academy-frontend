// src/features/lectures/components/BoardCategoryModal.tsx
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createBoardCategory } from "../api/board";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";

interface Props {
  lectureId: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function BoardCategoryModal({ lectureId, isOpen, onClose }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const title = useMemo(() => "게시판 카테고리 추가", []);

  const { mutate } = useMutation({
    mutationFn: async () => {
      setBusy(true);
      try {
        return await createBoardCategory({ lecture: lectureId, name });
      } finally {
        setBusy(false);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board-categories", lectureId] });
      onClose();
    },
  });

  if (!isOpen) return null;

  return (
    <AdminModal open={true} onClose={onClose} type="action" width={560} onEnterConfirm={name.trim() && !busy ? () => mutate() : undefined}>
      <ModalHeader type="action" title={title} />
      <ModalBody>
        <input
          className="ds-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
          autoFocus
        />
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button intent="secondary" onClick={onClose}>취소</Button>
            <Button intent="primary" onClick={() => name.trim() && mutate()} disabled={!name.trim() || busy}>
              추가
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
