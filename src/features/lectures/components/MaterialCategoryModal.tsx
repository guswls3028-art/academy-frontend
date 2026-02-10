// PATH: src/features/lectures/components/MaterialCategoryModal.tsx
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createMaterialCategory } from "../api/materials";

import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";

interface Props {
  lectureId: number;
  onClose: () => void;
}

export default function MaterialCategoryModal({ lectureId, onClose }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const title = useMemo(() => "자료실 카테고리 추가", []);

  const { mutate } = useMutation({
    mutationFn: async () => {
      setBusy(true);
      try {
        return await createMaterialCategory({ lecture: lectureId, name });
      } finally {
        setBusy(false);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material-categories", lectureId] });
      onClose();
    },
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (!busy && name.trim()) mutate();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, name]);

  return (
    <AdminModal open={true} onClose={onClose} type="action" width={560}>
      <ModalHeader type="action" title={title} description="⌘/Ctrl + Enter 로 저장" />

      <ModalBody>
        <div style={{ display: "grid", gap: 10 }}>
          <input
            className="ds-input"
            placeholder="예: 숙제, 시험, 복습 과제..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            autoFocus
          />
          <div style={{ fontSize: 11, fontWeight: 850, color: "var(--color-text-muted)" }}>
            빈 값은 저장할 수 없습니다.
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        left={
          <span style={{ fontSize: 12, fontWeight: 850, color: "var(--color-text-muted)" }}>
            ESC 로 닫기 · ⌘/Ctrl + Enter 저장
          </span>
        }
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={busy}>
              취소
            </Button>
            <Button
              intent="primary"
              onClick={() => {
                if (!name.trim()) return;
                mutate();
              }}
              disabled={busy || !name.trim()}
            >
              {busy ? "저장 중…" : "추가"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
