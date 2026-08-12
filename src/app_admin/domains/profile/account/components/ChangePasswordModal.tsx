// PATH: src/app_admin/domains/profile/account/components/ChangePasswordModal.tsx
// 비밀번호 변경 모달 — AdminModal SSOT (배경·테두리·헤더 톤 통일)

import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/ds";
import { useMutation } from "@tanstack/react-query";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { changePassword } from "../../api/profile.api";
import { extractApiError } from "@/shared/utils/extractApiError";
import { isPasswordChangeReady } from "@/shared/auth/passwordPolicy";
import { PasswordChecklist, PasswordInput } from "@/shared/ui/password";
import styles from "./ProfileAccountComponents.module.css";

const inputCls =
  "ds-input w-full";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[var(--text-sm)] font-medium text-[var(--color-text-secondary)]">
        {label}
      </div>
      {children}
    </div>
  );
}

export default function ChangePasswordModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const mut = useMutation({ mutationFn: changePassword });

  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [msg, setMsg] = useState("");
  const ready = isPasswordChangeReady(oldPw, newPw, confirmPw);

  useEffect(() => {
    if (!open) {
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
      setMsg("");
      mut.reset();
    }
    // mut를 의존성에 넣으면 참조 변경 시 무한 리렌더 → Maximum update depth exceeded 발생
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    setMsg("");
    if (!oldPw || !newPw) {
      setMsg("현재 비밀번호와 새 비밀번호를 모두 입력하세요.");
      return;
    }
    if (newPw.length < 4) {
      setMsg("새 비밀번호는 4자 이상이어야 합니다.");
      return;
    }
    if (oldPw === newPw) {
      setMsg("새 비밀번호는 현재 비밀번호와 달라야 합니다.");
      return;
    }
    if (newPw !== confirmPw) {
      setMsg("새 비밀번호가 일치하지 않습니다.");
      return;
    }

    try {
      await mut.mutateAsync({
        old_password: oldPw,
        new_password: newPw,
      });
      onClose();
      onSuccess();
    } catch (e: unknown) {
      setMsg(extractApiError(e, "비밀번호 변경에 실패했습니다."));
    }
  };

  if (!open) return null;

  return (
    <AdminModal open={open} onClose={onClose} width={MODAL_WIDTH.sm} onEnterConfirm={!mut.isPending ? submit : undefined}>
      <ModalHeader
        title="비밀번호 변경"
        description="현재 비밀번호를 입력한 뒤 새 비밀번호로 변경해 주세요."
      />
      <ModalBody>
        <div className="flex flex-col gap-4">
          <Field label="현재 비밀번호">
            <PasswordInput
              label="현재 비밀번호"
              inputClassName={inputCls}
              value={oldPw}
              onValueChange={setOldPw}
              placeholder="현재 비밀번호"
              aria-label="현재 비밀번호"
              autoComplete="current-password"
            />
          </Field>
          <Field label="새 비밀번호">
            <PasswordInput
              label="새 비밀번호"
              inputClassName={inputCls}
              value={newPw}
              onValueChange={setNewPw}
              placeholder="새 비밀번호"
              aria-label="새 비밀번호"
              autoComplete="new-password"
            />
          </Field>
          <Field label="새 비밀번호 확인">
            <PasswordInput
              label="새 비밀번호 확인"
              inputClassName={inputCls}
              value={confirmPw}
              onValueChange={setConfirmPw}
              placeholder="새 비밀번호 확인"
              aria-label="새 비밀번호 확인"
              autoComplete="new-password"
            />
          </Field>
          <PasswordChecklist
            password={newPw}
            currentPassword={oldPw}
            confirmation={confirmPw}
          />
          {msg && (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${styles.passwordError}`}
            >
              {msg}
            </div>
          )}
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
              onClick={submit}
              disabled={mut.isPending || !ready}
              loading={mut.isPending}
            >
              {mut.isPending ? "변경 중…" : "비밀번호 변경"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
