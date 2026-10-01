import { useState } from "react";
import { useRegistrationPasswordConfirmation } from "@/shared/product/students/RegistrationPasswordConfirmation";

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
  const confirmPasswords = useRegistrationPasswordConfirmation();
  const [restoring, setRestoring] = useState(false);

  const handleRestore = async () => {
    if (selectedStudents.length === 0 || restoring) return;
    setRestoring(true);
    try {
      const choice = await confirmPasswords({ title: "학생 복원 최종 확인", message: `${selectedStudents.length}명의 누락 학부모 계정에 사용할 비밀번호 방식을 선택해 주세요.`, confirmText: "복원", studentAlreadySelected: true, parentPhoneAvailable: selectedStudents.every((student) => /^010\d{8}$/.test(student.parentPhone ?? "")) });
      if (!choice) return;
      const result = await bulkRestoreStudents(
        selectedStudents.map((student) => student.id),
        choice.parentInitialPassword || undefined,
        choice.parentInitialPasswordMode,
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
        if (needsPassword) return;
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
            <p className="text-sm">누락 학부모 계정의 비밀번호 방식은 마지막 확인창에서 선택합니다.</p>
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
