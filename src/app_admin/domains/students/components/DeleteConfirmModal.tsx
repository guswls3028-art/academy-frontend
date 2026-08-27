// PATH: src/app_admin/domains/students/components/DeleteConfirmModal.tsx
import { useMemo, useState } from "react";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_DEFAULT_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { deleteStudent } from "../api/students.api";
import { feedback } from "@/shared/ui/feedback/feedback";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import styles from "./StudentUtilityModals.module.css";

export default function DeleteConfirmModal({
  open,
  id,
  onClose,
  onSuccess,
}: {
  open: boolean;
  id: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const title = useMemo(() => "학생 삭제", []);

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    try {
      await deleteStudent(id);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      feedback.error(getApiErrorMessage(err, "삭제에 실패했습니다."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminModal open={open} onClose={onClose} type="confirm" width={MODAL_DEFAULT_WIDTH} onEnterConfirm={!busy ? handleDelete : undefined}>
      <ModalHeader
        type="confirm"
        title={title}
        description="30일간 계정 로그인을 정지한 뒤 자동 영구 삭제합니다."
      />

      <ModalBody>
        <div className={styles.deleteMessage}>
          해당 학생을 정말 삭제하시겠습니까?
        </div>

        <div className={styles.deleteWarning}>
          수강·출결·성적·영상 진도 데이터와 삭제 전 수강 상태는 그대로 보존됩니다. 복원 시 진행 중인 강의만 삭제 전 상태로 돌아가며, 그 사이 종료된 강의는 비활성으로 유지됩니다.
        </div>
      </ModalBody>

      <ModalFooter
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={busy}>
              취소
            </Button>
            <Button intent="danger" onClick={handleDelete} disabled={busy}>
              {busy ? "삭제 중…" : "삭제"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
