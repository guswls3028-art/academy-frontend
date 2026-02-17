// PATH: src/features/profile/account/components/ProfileEditModal.tsx
// 내 정보 수정 모달 — 이름·전화번호·아이디(표시)·비밀번호 변경

import { useEffect, useState } from "react";
import { FiLock, FiSave, FiPhone, FiUser } from "react-icons/fi";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";

const LABEL_CLASS = "text-[var(--text-sm)] font-medium text-[var(--color-text-secondary)]";

type ProfileEditModalProps = {
  open: boolean;
  onClose: () => void;
  initialName: string;
  initialPhone: string;
  displayUsername: string;
  onSave: (payload: {
    name: string;
    phone: string;
    currentPassword?: string;
    newPassword?: string;
  }) => Promise<void>;
  saving?: boolean;
};

export default function ProfileEditModal({
  open,
  onClose,
  initialName,
  initialPhone,
  displayUsername,
  onSave,
  saving = false,
}: ProfileEditModalProps) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (open) {
      setName(initialName);
      setPhone(initialPhone);
      setCurrentPassword("");
      setNewPassword("");
    }
  }, [open, initialName, initialPhone]);

  const dirtyProfile = name !== initialName || phone !== initialPhone;
  const hasCurrentPw = !!currentPassword.trim();
  const hasNewPw = !!newPassword.trim();
  const dirtyPassword = hasCurrentPw && hasNewPw;
  const invalidPassword = (hasCurrentPw && !hasNewPw) || (!hasCurrentPw && hasNewPw); // 하나만 입력된 경우
  const dirty = (dirtyProfile || dirtyPassword) && !invalidPassword;

  const handleSave = async () => {
    await onSave({
      name: name.trim() || "",
      phone: phone.trim() || "",
      currentPassword: currentPassword.trim() || undefined,
      newPassword: newPassword.trim() || undefined,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <AdminModal open={open} onClose={onClose} width={MODAL_WIDTH.md}>
      <ModalHeader
        title="내 정보 수정"
        description="이름, 전화번호, 비밀번호를 수정할 수 있습니다."
      />
      <ModalBody>
        <div className="flex flex-col gap-5">
          {/* 이름 */}
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

          {/* 전화번호 */}
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

          {/* 아이디 (표시만) */}
          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS}>아이디</label>
            <input
              type="text"
              className="ds-input w-full"
              value={displayUsername || ""}
              readOnly
              disabled
              aria-label="아이디 (변경 불가)"
              style={{
                background: "var(--color-bg-surface-soft)",
                color: "var(--color-text-secondary)",
                cursor: "default",
              }}
            />
            <span className="text-[11px] font-medium text-[var(--color-text-muted)]">
              아이디는 변경할 수 없습니다.
            </span>
          </div>

          {/* 비밀번호 변경 */}
          <div className="flex flex-col gap-1.5 rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] p-4">
            <label className={`flex items-center gap-2 ${LABEL_CLASS}`}>
              <FiLock size={14} style={{ color: "var(--color-text-muted)" }} />
              비밀번호 변경
            </label>
            <span className={`text-[11px] font-medium mb-1 ${invalidPassword ? "text-[var(--color-error)]" : "text-[var(--color-text-muted)]"}`}>
              {invalidPassword
                ? "비밀번호를 변경하려면 현재 비밀번호와 새 비밀번호를 모두 입력하세요."
                : "변경하려면 현재 비밀번호와 새 비밀번호를 입력하세요. 비워두면 변경하지 않습니다."}
            </span>
            <input
              type="password"
              className="ds-input w-full"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="현재 비밀번호"
              aria-label="현재 비밀번호"
              autoComplete="current-password"
            />
            <input
              type="password"
              className="ds-input w-full"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="새 비밀번호"
              aria-label="새 비밀번호"
              autoComplete="new-password"
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
