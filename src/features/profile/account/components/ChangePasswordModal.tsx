// PATH: src/features/profile/account/components/ChangePasswordModal.tsx
// 비밀번호 변경 모달 — AdminModal SSOT (배경·테두리·헤더 톤 통일)

import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/ds";
import { useMutation } from "@tanstack/react-query";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { changePassword } from "../../api/profile.api";

const inputCls =
  "ds-input w-full";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[var(--text-sm)] font-medium text-[var(--color-text-secondary)]">
        {label}
      </div>
      {children}
    </div>
  );
}

export default function ChangePasswordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const mut = useMutation({ mutationFn: changePassword });

  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!open) {
      setOldPw("");
      setNewPw("");
      setMsg("");
      mut.reset();
    }
    // mut를 의존성에 넣으면 참조 변경 시 무한 리렌더 → Maximum update depth exceeded 발생
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = async () => {
    setMsg("");
    if (!oldPw || !newPw) {
      setMsg("현재 비밀번호와 새 비밀번호를 모두 입력하세요.");
      return;
    }

    try {
      await mut.mutateAsync({
        old_password: oldPw,
        new_password: newPw,
      });
      onClose();
    } catch (e: unknown) {
      const detail =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setMsg(detail || "비밀번호 변경 실패");
    }
  };

  if (!open) return null;

  return (
    <AdminModal open={open} onClose={onClose} width={MODAL_WIDTH.sm}>
      <ModalHeader
        title="비밀번호 변경"
        description="현재 비밀번호를 입력한 뒤 새 비밀번호로 변경해 주세요."
      />
      <ModalBody>
        <div className="flex flex-col gap-4">
          <Field label="현재 비밀번호">
            <input
              type="password"
              className={inputCls}
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
              placeholder="현재 비밀번호"
              aria-label="현재 비밀번호"
              autoComplete="current-password"
            />
          </Field>
          <Field label="새 비밀번호">
            <input
              type="password"
              className={inputCls}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="새 비밀번호"
              aria-label="새 비밀번호"
              autoComplete="new-password"
            />
          </Field>
          {msg && (
            <div
              className="rounded-lg border px-3 py-2 text-sm"
              style={{
                borderColor: "color-mix(in srgb, var(--color-error) 35%, var(--color-border-divider))",
                background: "color-mix(in srgb, var(--color-error) 10%, var(--color-modal-bg))",
                color: "var(--color-error)",
              }}
            >
              {msg}
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button type="button" intent="secondary" size="md" onClick={onClose}>
              취소
            </Button>
            <Button
              type="button"
              intent="primary"
              size="md"
              onClick={submit}
              disabled={mut.isPending}
              loading={mut.isPending}
            >
              {mut.isPending ? "변경 중…" : "비밀번호 변경"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
