// PATH: src/features/profile/account/components/ProfileEditModal.tsx
// 내 정보 수정 모달 — 이름·전화번호 편집

import { useEffect, useState } from "react";
import { FiSave, FiPhone, FiUser } from "react-icons/fi";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";

const LABEL_CLASS = "text-[var(--text-sm)] font-medium text-[var(--color-text-secondary)]";

type ProfileEditModalProps = {
  open: boolean;
  onClose: () => void;
  initialName: string;
  initialPhone: string;
  onSave: (payload: { name: string; phone: string }) => Promise<void>;
  saving?: boolean;
};

export default function ProfileEditModal({
  open,
  onClose,
  initialName,
  initialPhone,
  onSave,
  saving = false,
}: ProfileEditModalProps) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setPhone(initialPhone);
    }
  }, [open, initialName, initialPhone]);

  const dirty = name !== initialName || phone !== initialPhone;

  const handleSave = async () => {
    await onSave({
      name: name.trim() || "",
      phone: phone.trim() || "",
    });
    onClose();
  };

  if (!open) return null;

  return (
    <AdminModal open={open} onClose={onClose} width={MODAL_WIDTH.sm}>
      <ModalHeader title="내 정보 수정" description="이름과 전화번호를 수정할 수 있습니다." />
      <ModalBody>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={`flex items-center gap-2 ${LABEL_CLASS}`}>
              <FiUser size={14} style={{ color: "var(--color-text-muted)" }} />
              이름
            </label>
            <input
              type="text"
              className="ds-input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력하세요"
              aria-label="이름"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={`flex items-center gap-2 ${LABEL_CLASS}`}>
              <FiPhone size={14} style={{ color: "var(--color-text-muted)" }} />
              전화번호
            </label>
            <input
              type="tel"
              className="ds-input w-full"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="전화번호를 입력하세요"
              aria-label="전화번호"
            />
          </div>
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button type="button" intent="secondary" size="md" onClick={onClose}>
              취소
            </Button>
            <Button
              type="button"
              intent="primary"
              size="md"
              onClick={handleSave}
              disabled={saving || !dirty}
              loading={saving}
              leftIcon={!saving ? <FiSave size={14} /> : undefined}
            >
              {saving ? "저장 중…" : "저장"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
