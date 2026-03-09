// PATH: src/features/students/components/PasswordResetModal.tsx
// 선택한 학생에게 임시 비밀번호 발송 (학생 번호 또는 학부모 번호로)

import type { ClientStudent } from "../api/students";
import { sendPasswordReset } from "../api/students";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";

type PasswordResetModalProps = {
  open: boolean;
  onClose: () => void;
  selectedStudents: ClientStudent[];
  target: "student" | "parent";
  onTargetChange: (t: "student" | "parent") => void;
  onSuccess: () => void;
  resetting: boolean;
  setResetting: (v: boolean) => void;
};

function normalizePhone(v: string | null | undefined): string {
  if (v == null) return "";
  const d = String(v).replace(/\D/g, "");
  return d.length === 11 && d.startsWith("010") ? d : d.length === 10 && d.startsWith("10") ? "0" + d : d;
}

export default function PasswordResetModal({
  open,
  onClose,
  selectedStudents,
  target,
  onTargetChange,
  onSuccess,
  resetting,
  setResetting,
}: PasswordResetModalProps) {
  const handleSubmit = async () => {
    if (selectedStudents.length === 0) {
      feedback.info("선택한 학생이 없습니다.");
      return;
    }
    setResetting(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const s of selectedStudents) {
        try {
          if (target === "student") {
            if (!s.psNumber?.trim()) {
              fail++;
              continue;
            }
            await sendPasswordReset({
              target: "student",
              student_name: s.name,
              student_ps_number: s.psNumber.trim(),
            });
          } else {
            const phone = normalizePhone(s.parentPhone);
            if (phone.length !== 11) {
              fail++;
              continue;
            }
            await sendPasswordReset({
              target: "parent",
              student_name: s.name,
              parent_phone: phone,
            });
          }
          ok++;
        } catch {
          fail++;
        }
      }
      if (ok > 0) feedback.success(`임시 비밀번호 발송 완료 (${ok}명${fail > 0 ? `, 실패 ${fail}명` : ""}).`);
      if (fail > 0 && ok === 0) feedback.error("발송에 실패했습니다. 학생 번호·학부모 전화번호를 확인하세요.");
      if (ok > 0) onSuccess();
    } finally {
      setResetting(false);
    }
  };

  if (!open) return null;

  return (
    <AdminModal open={open} onClose={onClose} width={MODAL_WIDTH.sm}>
      <ModalHeader
        title="비밀번호 변경 (임시 비밀번호 발송)"
        description={`선택한 ${selectedStudents.length}명에게 임시 비밀번호를 발송합니다. 수신 대상을 선택하세요.`}
      />
      <ModalBody>
        <div className="space-y-3">
          <div>
            <span className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">발송 대상</span>
            <div className="flex gap-4">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="pwResetTarget"
                  checked={target === "student"}
                  onChange={() => onTargetChange("student")}
                  disabled={resetting}
                />
                <span>학생 번호로 발송</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="pwResetTarget"
                  checked={target === "parent"}
                  onChange={() => onTargetChange("parent")}
                  disabled={resetting}
                />
                <span>학부모 전화번호로 발송</span>
              </label>
            </div>
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">
            {target === "student"
              ? "각 학생의 로그인용 학생 번호로 임시 비밀번호를 발송합니다."
              : "각 학생의 학부모 전화번호(010 11자리)로 임시 비밀번호를 발송합니다."}
          </p>
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button type="button" intent="secondary" size="md" onClick={onClose} disabled={resetting}>
              취소
            </Button>
            <Button
              type="button"
              intent="primary"
              size="md"
              onClick={handleSubmit}
              disabled={resetting || selectedStudents.length === 0}
              loading={resetting}
            >
              {resetting ? "발송 중…" : "임시 비밀번호 발송"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
