import { useEffect, useState } from "react";
import { FiMessageSquare } from "react-icons/fi";

import type { ClientStudent } from "../api/students.api";
import { sendStudentAccountGuidance } from "../api/students.api";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import { formatPhone } from "@/shared/utils/formatPhone";

export type AccountGuidanceSelection = "student" | "parent" | "both";

type AccountGuidanceModalProps = {
  open: boolean;
  onClose: () => void;
  student: ClientStudent;
  onSuccess: () => void;
};

export default function AccountGuidanceModal({
  open,
  onClose,
  student,
  onSuccess,
}: AccountGuidanceModalProps) {
  const studentRecipient = student.studentPhone || student.parentPhone || "";
  const parentRecipient = student.parentPhone || "";
  const hasStudentRecipient = Boolean(studentRecipient);
  const hasParentRecipient = Boolean(parentRecipient);
  const [target, setTarget] = useState<AccountGuidanceSelection>(
    hasStudentRecipient && hasParentRecipient ? "both" : hasStudentRecipient ? "student" : "parent",
  );
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTarget(hasStudentRecipient && hasParentRecipient ? "both" : hasStudentRecipient ? "student" : "parent");
  }, [hasParentRecipient, hasStudentRecipient, open]);

  if (!open) return null;

  const submit = async () => {
    const targets: ("student" | "parent")[] = target === "both" ? ["student", "parent"] : [target];
    let sent = 0;
    const failures: string[] = [];
    setSending(true);
    try {
      for (const current of targets) {
        try {
          await sendStudentAccountGuidance(student.id, current);
          sent += 1;
        } catch (error) {
          failures.push(`${current === "student" ? "학생" : "학부모"}: ${extractApiError(error, "발송 실패")}`);
        }
      }
      if (sent > 0) feedback.success(`아이디 안내 알림톡 ${sent}건을 발송했습니다.`);
      if (failures.length) feedback.error(failures.join(" · "));
      if (sent > 0) onSuccess();
      if (sent > 0 && failures.length === 0) onClose();
    } finally {
      setSending(false);
    }
  };

  const options = [
    { value: "student" as const, label: "학생", disabled: !hasStudentRecipient },
    { value: "parent" as const, label: "학부모", disabled: !hasParentRecipient },
    { value: "both" as const, label: "둘 다", disabled: !hasStudentRecipient || !hasParentRecipient },
  ];

  return (
    <AdminModal open={open} onClose={onClose} width={MODAL_WIDTH.sm}>
      <ModalHeader
        title="아이디 안내 알림톡"
        description="등록된 번호로 로그인 아이디를 안내합니다. 현재 비밀번호와 로그인 상태는 변경되지 않습니다."
      />
      <ModalBody>
        <div className="space-y-4">
          <div>
            <span className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">발송 대상</span>
            <div className="grid grid-cols-3 gap-2">
              {options.map((option) => (
                <label
                  key={option.value}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-3 text-sm cursor-pointer has-[:checked]:border-[var(--color-primary)] has-[:checked]:bg-[var(--color-primary-subtle)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
                >
                  <input
                    type="radio"
                    name="accountGuidanceTarget"
                    checked={target === option.value}
                    onChange={() => setTarget(option.value)}
                    disabled={sending || option.disabled}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-[var(--color-bg-subtle)] p-3 text-sm text-[var(--color-text-secondary)]">
            <div>학생 수신: {studentRecipient ? `${formatPhone(studentRecipient)}${!student.studentPhone && student.parentPhone ? " (학부모 번호)" : ""}` : "발송 불가"}</div>
            <div className="mt-1">학부모 수신: {parentRecipient ? formatPhone(parentRecipient) : "발송 불가"}</div>
          </div>

          <div className="flex gap-3 rounded-xl border border-[var(--color-border)] p-3">
            <FiMessageSquare size={18} className="mt-0.5 shrink-0 text-[var(--color-primary)]" aria-hidden />
            <div>
              <div className="text-sm font-semibold text-[var(--color-text)]">아이디만 안전하게 안내</div>
              <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">비밀번호를 잊은 경우에는 학생 상세의 비밀번호 초기화를 별도로 사용해 주세요.</div>
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button type="button" intent="secondary" size="md" onClick={onClose} disabled={sending}>취소</Button>
            <Button
              type="button"
              intent="primary"
              size="md"
              onClick={submit}
              disabled={sending || (target === "student" ? !hasStudentRecipient : target === "parent" ? !hasParentRecipient : !hasStudentRecipient || !hasParentRecipient)}
              loading={sending}
            >
              {sending ? "발송 중…" : "아이디 안내 보내기"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
