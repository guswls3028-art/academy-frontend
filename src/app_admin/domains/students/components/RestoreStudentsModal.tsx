import { useEffect, useState } from "react";

import { bulkRestoreStudents, type ClientStudent } from "../api/students.api";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { getApiErrorMessage } from "@/shared/api/errorMessage";

type Props = {
  open: boolean;
  onClose: () => void;
  selectedStudents: ClientStudent[];
  onSelectionChange: (studentIds: number[]) => void;
  onChanged: () => void;
};

export default function RestoreStudentsModal({
  open,
  onClose,
  selectedStudents,
  onSelectionChange,
  onChanged,
}: Props) {
  const [parentInitialPassword, setParentInitialPassword] = useState("");
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (open) setParentInitialPassword("");
  }, [open]);

  const handleRestore = async () => {
    if (selectedStudents.length === 0 || restoring) return;
    const password = parentInitialPassword.trim();
    if (password && password.length < 4) {
      feedback.error("학부모 초기 비밀번호는 4자 이상 입력해 주세요.");
      return;
    }

    setRestoring(true);
    try {
      const result = await bulkRestoreStudents(
        selectedStudents.map((student) => student.id),
        password || undefined,
      );
      const skipped = result.skipped ?? [];
      if (skipped.length > 0) {
        if (result.restored > 0) onChanged();
        onSelectionChange(skipped.map((student) => student.id));
        const needsPassword = skipped.some(
          (student) => student.code === "parent_account_password_required",
        );
        const reason = skipped[0]?.reason ? ` ${skipped[0].reason}` : "";
        feedback.warning(
          `${result.restored}명 복원, ${skipped.length}명은 복원하지 못했습니다.${reason}`,
        );
        if (needsPassword && !password) return;
        return;
      }

      feedback.success(`${result.restored}명 복원되었습니다.`);
      onSelectionChange([]);
      onChanged();
      onClose();
    } catch (error: unknown) {
      feedback.error(getApiErrorMessage(error, "복원 중 오류가 발생했습니다."));
    } finally {
      setRestoring(false);
    }
  };

  if (!open) return null;

  return (
    <AdminModal open={open} onClose={onClose} width={MODAL_WIDTH.sm}>
      <ModalHeader
        title="학생 복원"
        description={`선택한 ${selectedStudents.length}명의 계정과 삭제 전 수강 상태를 복원합니다.`}
      />
      <ModalBody>
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            그 사이 종료된 강의는 비활성 상태로 유지됩니다.
          </p>
          <div>
            <label
              className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1"
              htmlFor="restore-parent-initial-password"
            >
              누락 학부모 계정 초기 비밀번호 <span className="text-[var(--color-text-muted)]">(선택)</span>
            </label>
            <input
              id="restore-parent-initial-password"
              type="password"
              className="ds-input w-full"
              placeholder="필요한 경우 4자 이상 직접 입력"
              value={parentInitialPassword}
              onChange={(event) => setParentInitialPassword(event.target.value)}
              disabled={restoring}
              minLength={4}
              autoComplete="new-password"
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              정상 학부모 계정의 비밀번호는 바뀌지 않습니다. 과거 데이터에 계정이 없거나 비밀번호가 없는 경우에만 사용하고 알림톡으로 안내합니다.
            </p>
          </div>
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button type="button" intent="secondary" size="md" onClick={onClose} disabled={restoring}>
              취소
            </Button>
            <Button
              type="button"
              intent="primary"
              size="md"
              onClick={handleRestore}
              disabled={restoring || selectedStudents.length === 0}
              loading={restoring}
            >
              {restoring ? "복원 중…" : "복원"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
