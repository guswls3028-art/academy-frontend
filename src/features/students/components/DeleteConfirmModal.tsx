// PATH: src/features/students/components/DeleteConfirmModal.tsx
import { useEffect, useMemo, useState } from "react";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_DEFAULT_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { deleteStudent } from "../api/students";

export default function DeleteConfirmModal({
  open,
  id,
  onClose,
  onSuccess,
}: {
  open: boolean;
  id: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const title = useMemo(() => "학생 삭제", []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    try {
      await deleteStudent(id);
      onSuccess();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminModal open={open} onClose={onClose} type="confirm" width={MODAL_DEFAULT_WIDTH}>
      <ModalHeader
        type="confirm"
        title={title}
        description="삭제된 데이터는 복구할 수 없습니다."
      />

      <ModalBody>
        <div
          style={{
            fontSize: 13,
            fontWeight: 850,
            color: "var(--color-text-secondary)",
            lineHeight: 1.6,
          }}
        >
          해당 학생을 정말 삭제하시겠습니까?
        </div>

        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 12,
            border:
              "1px solid color-mix(in srgb, var(--color-error) 22%, var(--color-border-divider))",
            background:
              "color-mix(in srgb, var(--color-error) 6%, var(--color-bg-surface))",
            color: "var(--color-text-secondary)",
            fontSize: 12,
            fontWeight: 850,
            letterSpacing: "-0.12px",
          }}
        >
          삭제 후에는 학생 정보/태그/메모/연결된 이력이 복구되지 않습니다.
        </div>
      </ModalBody>

      <ModalFooter
        left={
          <span
            style={{
              fontSize: 12,
              fontWeight: 850,
              color: "var(--color-text-muted)",
            }}
          >
            ESC 로 닫기
          </span>
        }
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={busy}>
              취소
            </Button>
            <Button intent="danger" onClick={handleDelete} disabled={busy}>
              {busy ? "삭제 중…" : "삭제"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
