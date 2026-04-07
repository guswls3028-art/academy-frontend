import { useState } from "react";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { changeStaffPassword } from "../api/staff.detail.api";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 비밀번호를 변경할 직원 목록 */
  staffList: { id: number; name: string }[];
}

export default function StaffPasswordModal({ open, onClose, staffList }: Props) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

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

    setBusy(true);
    let successCount = 0;
    let failCount = 0;
    const failNames: string[] = [];

    for (const staff of staffList) {
      try {
        await changeStaffPassword(staff.id, pw);
        successCount++;
      } catch (e: unknown) {
        failCount++;
        failNames.push(`${staff.name}: ${extractApiError(e, "변경 실패")}`);
      }
    }

    setBusy(false);

    if (failCount === 0) {
      feedback.success(
        staffList.length === 1
          ? `${staffList[0].name}의 비밀번호가 변경되었습니다.`
          : `${successCount}명의 비밀번호가 변경되었습니다.`,
      );
      setPassword("");
      onClose();
    } else if (successCount === 0) {
      feedback.error(`비밀번호 변경 실패: ${failNames.join(", ")}`);
    } else {
      feedback.warning(`${successCount}명 성공, ${failCount}명 실패: ${failNames.join(", ")}`);
      setPassword("");
      onClose();
    }
  };

  const names = staffList.map((s) => s.name).join(", ");

  return (
    <AdminModal open onClose={onClose} type="action" onEnterConfirm={!busy ? handleSubmit : undefined}>
      <ModalHeader
        type="action"
        title="비밀번호 변경"
        description={
          staffList.length === 1
            ? `${names}의 비밀번호를 변경합니다.`
            : `${names} (${staffList.length}명)의 비밀번호를 일괄 변경합니다.`
        }
      />
      <ModalBody>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--color-text-muted)" }}>
              새 비밀번호 *
            </div>
            <input
              type="password"
              className="ds-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="4자 이상 입력"
              autoFocus
              disabled={busy}
            />
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            선택한 직원 전원에게 동일한 비밀번호가 적용됩니다.
            변경 후 직원에게 새 비밀번호를 안내해 주세요.
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
