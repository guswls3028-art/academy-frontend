// PATH: src/features/students/components/PasswordResetModal.tsx
// 선택한 학생에게 임시 비밀번호 일괄 설정 (학생/학부모/둘 다 + 알림톡 발송 토글)

import { useState } from "react";
import { Switch } from "antd";
import { FiMessageSquare } from "react-icons/fi";
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

/* ── 알림톡 발송 토글 (StudentCreateModal과 동일 디자인) ── */

function NotifyToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border-divider)",
        background: checked
          ? "color-mix(in srgb, var(--color-primary) 5%, var(--color-bg-surface))"
          : "var(--color-bg-surface-soft)",
        boxShadow: checked ? "inset 3px 0 0 var(--color-primary)" : undefined,
        transition: "background 0.15s, box-shadow 0.15s",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "var(--radius-md)",
          background: checked
            ? "color-mix(in srgb, var(--color-primary) 12%, transparent)"
            : "var(--color-bg-surface-soft)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: checked ? "var(--color-primary)" : "var(--color-text-muted)",
          flexShrink: 0,
        }}
      >
        <FiMessageSquare size={15} aria-hidden />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: checked ? "var(--color-text-primary)" : "var(--color-text-muted)",
          }}
        >
          임시 비밀번호 알림톡 발송
        </span>
        <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 1, lineHeight: 1.3 }}>
          {checked
            ? "변경된 비밀번호를 학생·학부모에게 알림톡으로 보냅니다"
            : "켜면 임시 비밀번호를 알림톡으로 발송합니다"}
        </div>
      </div>
      <Switch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        size="small"
      />
    </div>
  );
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
  const [tempPassword, setTempPassword] = useState("");
  const [sendNotify, setSendNotify] = useState(true);

  const handleSubmit = async () => {
    if (selectedStudents.length === 0) {
      feedback.info("선택한 학생이 없습니다.");
      return;
    }
    if (!sendNotify && !tempPassword.trim()) {
      feedback.error("알림톡을 보내지 않으려면 임시 비밀번호를 직접 입력해 주세요.");
      return;
    }
    setResetting(true);
    let ok = 0;
    let fail = 0;
    const failNames: string[] = [];

    const targets: ("student" | "parent")[] =
      target === "both" ? ["student", "parent"] : [target];

    try {
      for (const s of selectedStudents) {
        for (const t of targets) {
          try {
            if (t === "student") {
              if (!s.psNumber?.trim()) {
                fail++;
                failNames.push(`${s.name}(아이디 없음)`);
                continue;
              }
              await sendPasswordReset({
                target: "student",
                student_name: s.name,
                student_ps_number: s.psNumber.trim(),
                ...(tempPassword.trim() ? { temp_password: tempPassword.trim() } : {}),
                ...(!sendNotify ? { skip_notify: true } : {}),
              });
            } else {
              const phone = normalizePhone(s.parentPhone);
              if (phone.length !== 11) {
                fail++;
                failNames.push(`${s.name}(학부모번호 없음)`);
                continue;
              }
              await sendPasswordReset({
                target: "parent",
                student_name: s.name,
                parent_phone: phone,
                ...(tempPassword.trim() ? { temp_password: tempPassword.trim() } : {}),
                ...(!sendNotify ? { skip_notify: true } : {}),
              });
            }
            ok++;
          } catch {
            fail++;
            failNames.push(`${s.name}(${t})`);
          }
        }
      }
      if (ok > 0) {
        const notifyMsg = sendNotify ? " 알림톡이 발송됩니다." : "";
        feedback.success(`비밀번호 변경 완료 (${ok}건${fail > 0 ? `, 실패 ${fail}건` : ""}).${notifyMsg}`);
      }
      if (fail > 0 && ok === 0) {
        feedback.error(`변경 실패: ${failNames.join(", ")}`);
      } else if (fail > 0) {
        feedback.info(`일부 실패: ${failNames.join(", ")}`);
      }
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
        description={`선택한 ${selectedStudents.length}명의 비밀번호를 변경합니다.`}
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
              입력하면 선택한 모든 대상에게 동일한 비밀번호가 설정됩니다.
            </p>
          </div>

          {/* 변경 대상 */}
          <div>
            <span className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">변경 대상</span>
            <div className="flex gap-3">
              {([
                { value: "student" as const, label: "학생" },
                { value: "parent" as const, label: "학부모" },
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
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {target === "student" && "학생 로그인 비밀번호를 변경합니다."}
              {target === "parent" && "학부모 로그인 비밀번호를 변경합니다. (학부모 아이디 = 전화번호)"}
              {target === "both" && "학생 + 학부모 비밀번호를 모두 변경합니다."}
            </p>
          </div>

          {/* 알림톡 발송 토글 */}
          <NotifyToggle checked={sendNotify} onChange={setSendNotify} disabled={resetting} />
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
              {resetting ? "변경 중…" : "비밀번호 변경"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
