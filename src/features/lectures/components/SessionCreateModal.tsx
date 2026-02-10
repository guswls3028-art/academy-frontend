// PATH: src/features/lectures/components/SessionCreateModal.tsx
import { useEffect, useState } from "react";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { createSession } from "../api/sessions";

interface Props {
  lectureId: number;
  onClose: () => void;
}

export default function SessionCreateModal({ lectureId, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    date: "",
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleSubmit();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, busy]);

  function handleChange(e: any) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  }

  function validate(): string | null {
    if (!form.title.trim()) return "차시 제목은 필수입니다.";
    return null;
  }

  async function handleSubmit() {
    if (busy) return;
    const err = validate();
    if (err) return alert(err);

    setBusy(true);
    try {
      await createSession(lectureId, form);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminModal open={true} onClose={onClose} type="action" width={560}>
      <ModalHeader
        type="action"
        title="차시 추가"
        description="⌘/Ctrl + Enter 로 저장"
      />

      <ModalBody>
        <div style={{ display: "grid", gap: 12 }}>
          <input
            name="title"
            placeholder="차시 제목"
            value={form.title}
            onChange={handleChange}
            className="ds-input"
            data-required="true"
            data-invalid={!form.title.trim() ? "true" : "false"}
            disabled={busy}
            autoFocus
          />

          <input
            name="date"
            type="date"
            value={form.date}
            onChange={handleChange}
            className="ds-input"
            disabled={busy}
          />
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
            <Button intent="primary" onClick={handleSubmit} disabled={busy}>
              {busy ? "저장 중…" : "저장"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
