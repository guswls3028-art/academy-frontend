// PATH: src/features/students/components/TagCreateModal.tsx
// 태그 생성 모달 — 이름 + 색상

import { useState, useEffect } from "react";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { ColorPickerField, getDefaultColorForPicker } from "@/shared/ui/domain";
import { createTag } from "../api/students";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: (tag: { id: number; name: string; color: string }) => void;
  /** 이미 사용 중인 색상 — 기본값이 이들과 최대한 차이나도록 선택됨 */
  usedColors?: string[];
};

export default function TagCreateModal({
  open,
  onClose,
  onSuccess,
  usedColors = [],
}: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(() => getDefaultColorForPicker(usedColors));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setColor(getDefaultColorForPicker(usedColors));
    setBusy(false);
    setError(null);
  }, [open, usedColors]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("태그 이름을 입력하세요.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const tag = await createTag(trimmed, color);
      onSuccess(tag);
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.name?.[0] ||
        err?.response?.data?.detail ||
        "태그 생성에 실패했습니다.";
      setError(typeof msg === "string" ? msg : "태그 생성에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminModal open={open} onClose={onClose} type="action" width={MODAL_WIDTH.sm}>
      <ModalHeader
        title="태그 생성"
        description="이름과 색상을 정하면 꼬리표처럼 학생에 붙습니다."
      />
      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact" style={{ display: "flex", flexDirection: "column" }}>
          <div className="modal-form-group modal-form-group--compact">
            <label className="modal-section-label">태그 이름</label>
            <input
              type="text"
              className="ds-input w-full"
              placeholder="예: VIP, 재수생, 수학반"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              maxLength={50}
              style={{ fontSize: 14 }}
              autoFocus
            />
            {error && (
              <div className="modal-hint" style={{ marginTop: "var(--space-2)", color: "var(--color-error)" }}>
                {error}
              </div>
            )}
          </div>
          <ColorPickerField label="색상" value={color} onChange={setColor} disabled={busy} />
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button intent="ghost" size="sm" onClick={onClose}>
              취소
            </Button>
            <Button
              intent="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={busy || !name.trim()}
            >
              {busy ? "생성 중…" : "생성 후 붙이기"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
