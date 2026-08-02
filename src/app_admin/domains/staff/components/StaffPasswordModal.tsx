import React, { useState } from "react";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { changeStaffPassword } from "../api/staff.detail.api";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import styles from "./StaffPasswordModal.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 비밀번호를 변경할 직원 한 명 */
  staffList: { id: number; name: string }[];
}

export default function StaffPasswordModal({ open, onClose, staffList }: Props) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // 모달 열릴 때 상태 초기화 (이전 입력 잔존 방지)
  React.useEffect(() => {
    if (open) { setPassword(""); setBusy(false); }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    const pw = password.trim();
    if (!pw) {
      feedback.warning("새 비밀번호를 입력하세요.");
      return;
    }
    if (pw.length < 4) {
      feedback.warning("비밀번호는 4자 이상이어야 합니다.");
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
      feedback.success(`${staff.name}의 임시 비밀번호가 설정되었습니다.`);
      setPassword("");
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
        title="임시 비밀번호 설정"
        description={`${names}의 비밀번호를 재설정합니다.`}
      />
      <ModalBody>
        <div className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="staff-password" className={styles.label}>새 비밀번호 *</label>
            <input
              id="staff-password"
              type="password"
              className="ds-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="4자 이상 입력"
              autoFocus
              disabled={busy}
              autoComplete="new-password"
            />
          </div>
          <div className={styles.notice}>
            기존 로그인은 만료되며, 직원은 다음 로그인에서 비밀번호를 변경해야 합니다.
          </div>
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={busy}>
              취소
            </Button>
            <Button intent="primary" onClick={handleSubmit} disabled={busy}>
              {busy ? "변경 중…" : "변경"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
