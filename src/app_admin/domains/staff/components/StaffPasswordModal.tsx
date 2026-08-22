import React, { useState } from "react";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { changeStaffPassword } from "../api/staff.detail.api";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import {
  generateTemporaryPassword,
  isPasswordConfirmationReady,
  PASSWORD_MIN_LENGTH,
} from "@/shared/auth/passwordPolicy";
import { PasswordChecklist, PasswordInput } from "@/shared/ui/password";
import styles from "./StaffPasswordModal.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 비밀번호를 변경할 직원 한 명 */
  staffList: { id: number; name: string }[];
}

export default function StaffPasswordModal({ open, onClose, staffList }: Props) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = isPasswordConfirmationReady(password.trim(), confirmation.trim());

  // 모달 열릴 때 상태 초기화 (이전 입력 잔존 방지)
  React.useEffect(() => {
    if (open) { setPassword(""); setConfirmation(""); setBusy(false); }
  }, [open]);

  if (!open) return null;

  const handleGenerate = () => {
    try {
      const generated = generateTemporaryPassword();
      setPassword(generated);
      setConfirmation(generated);
      feedback.success("안전한 비밀번호를 만들었습니다.");
    } catch (e: unknown) {
      feedback.error(extractApiError(e, "비밀번호를 자동으로 만들 수 없습니다."));
    }
  };

  const handleCopy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      feedback.success("비밀번호를 복사했습니다. 안전한 방법으로 전달해 주세요.");
    } catch {
      feedback.error("복사하지 못했습니다. 비밀번호 보기 후 직접 복사해 주세요.");
    }
  };

  const handleSubmit = async () => {
    const pw = password.trim();
    if (!pw) {
      feedback.warning("새 비밀번호를 입력하세요.");
      return;
    }
    if (pw.length < PASSWORD_MIN_LENGTH) {
      feedback.warning(`비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`);
      return;
    }
    if (pw !== confirmation.trim()) {
      feedback.warning("새 비밀번호가 일치하지 않습니다.");
      return;
    }

    const staff = staffList[0];
    if (!staff) {
      feedback.warning("비밀번호를 변경할 직원 한 명을 선택해 주세요.");
      return;
    }
    setBusy(true);
    try {
      await changeStaffPassword(staff.id, pw);
      feedback.success(`${staff.name}의 비밀번호가 설정되었습니다.`);
      setPassword("");
      setConfirmation("");
      onClose();
    } catch (e: unknown) {
      feedback.error(extractApiError(e, "비밀번호 변경에 실패했습니다."));
    } finally {
      setBusy(false);
    }
  };

  const names = staffList.map((s) => s.name).join(", ");

  return (
    <AdminModal open onClose={onClose} type="action" closeDisabled={busy} onEnterConfirm={!busy ? handleSubmit : undefined}>
      <ModalHeader
        type="action"
        title="비밀번호 설정"
        description={`${names}의 비밀번호를 재설정합니다.`}
      />
      <ModalBody>
        <div className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="staff-password" className={styles.label}>새 비밀번호 *</label>
            <PasswordInput
              id="staff-password"
              label="새 비밀번호"
              inputClassName="ds-input"
              value={password}
              onValueChange={setPassword}
              placeholder="4자 이상 입력"
              autoFocus
              disabled={busy}
              autoComplete="new-password"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="staff-password-confirmation" className={styles.label}>새 비밀번호 확인 *</label>
            <PasswordInput
              id="staff-password-confirmation"
              label="새 비밀번호 확인"
              inputClassName="ds-input"
              value={confirmation}
              onValueChange={setConfirmation}
              placeholder="한 번 더 입력"
              disabled={busy}
              autoComplete="new-password"
            />
          </div>
          <div className={styles.tools}>
            <Button type="button" intent="secondary" size="sm" onClick={handleGenerate} disabled={busy}>
              안전한 비밀번호 만들기
            </Button>
            <Button type="button" intent="ghost" size="sm" onClick={handleCopy} disabled={busy || !password}>
              복사
            </Button>
          </div>
          <PasswordChecklist password={password} confirmation={confirmation} />
          <div className={styles.notice}>
            변경하면 기존 로그인은 만료됩니다. 설정한 비밀번호는 직원이 즉시 로그인에
            계속 사용할 수 있습니다.
          </div>
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={busy}>
              취소
            </Button>
            <Button intent="primary" onClick={handleSubmit} disabled={busy || !ready}>
              {busy ? "변경 중…" : "변경"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
