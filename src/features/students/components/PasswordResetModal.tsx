// PATH: src/features/students/components/PasswordResetModal.tsx
// 선택한 학생에게 임시 비밀번호 일괄 발송 (학생/학부모/둘 다 + 커스텀 비밀번호)

import { useState } from "react";
import type { ClientStudent } from "../api/students";
import { sendPasswordReset } from "../api/students";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";

export type PwResetTarget = "student" | "parent" | "both";

type PasswordResetModalProps = {
  open: boolean;
  onClose: () => void;
  selectedStudents: ClientStudent[];
  target: PwResetTarget;
  onTargetChange: (t: PwResetTarget) => void;
  onSuccess: () => void;
  resetting: boolean;
  setResetting: (v: boolean) => void;
};

function normalizePhone(v: string | null | undefined): string {
  if (v == null) return "";
  const d = String(v).replace(/\D/g, "");
  return d.length === 11 && d.startsWith("010") ? d : d.length === 10 && d.startsWith("10") ? "0" + d : d;
}

const TEMPLATE_MSG = `[{학원명}] {학생이름} 학생의 임시 비밀번호는 {비밀번호} 입니다. 로그인 후 비밀번호를 변경해 주세요.`;

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
  const [tempPassword, setTempPassword] = useState("");

  const handleSubmit = async () => {
    if (selectedStudents.length === 0) {
      feedback.info("선택한 학생이 없습니다.");
      return;
    }
    setResetting(true);
    let ok = 0;
    let fail = 0;

    const targets: ("student" | "parent")[] =
      target === "both" ? ["student", "parent"] : [target];

    try {
      for (const s of selectedStudents) {
        for (const t of targets) {
          try {
            if (t === "student") {
              if (!s.psNumber?.trim()) {
                fail++;
                continue;
              }
              await sendPasswordReset({
                target: "student",
                student_name: s.name,
                student_ps_number: s.psNumber.trim(),
                ...(tempPassword.trim() ? { temp_password: tempPassword.trim() } : {}),
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
                ...(tempPassword.trim() ? { temp_password: tempPassword.trim() } : {}),
              });
            }
            ok++;
          } catch {
            fail++;
          }
        }
      }
      if (ok > 0) feedback.success(`임시 비밀번호 발송 완료 (${ok}건${fail > 0 ? `, 실패 ${fail}건` : ""}).`);
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
        title="비밀번호 일괄 변경"
        description={`선택한 ${selectedStudents.length}명에게 임시 비밀번호를 설정하고 발송합니다.`}
      />
      <ModalBody>
        <div className="space-y-4">
          {/* 임시 비밀번호 입력 */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              임시 비밀번호
            </label>
            <input
              type="text"
              className="ds-input w-full"
              placeholder="비워두면 자동 생성"
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              disabled={resetting}
              autoComplete="off"
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              입력하면 선택한 모든 학생에게 동일한 비밀번호가 설정됩니다.
            </p>
          </div>

          {/* 발송 대상 */}
          <div>
            <span className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">발송 대상</span>
            <div className="flex gap-3">
              {([
                { value: "student" as const, label: "학생 번호" },
                { value: "parent" as const, label: "학부모 번호" },
                { value: "both" as const, label: "둘 다" },
              ]).map(({ value, label }) => (
                <label key={value} className="inline-flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="pwResetTarget"
                    checked={target === value}
                    onChange={() => onTargetChange(value)}
                    disabled={resetting}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 발송 템플릿 안내 */}
          <div className="rounded-md border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] p-3">
            <span className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">발송 메시지 템플릿</span>
            <p className="text-xs text-[var(--color-text-muted)] whitespace-pre-wrap leading-relaxed">
              {TEMPLATE_MSG}
            </p>
          </div>
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
