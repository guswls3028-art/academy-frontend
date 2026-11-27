import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import api from "@/shared/api/axios";
import { isPasswordChangeReady } from "@/shared/auth/passwordPolicy";
import { PasswordChecklist, PasswordInput } from "@/shared/ui/password";
import { extractApiError } from "@/shared/utils/extractApiError";
import styles from "./AccountPrompt.module.css";

async function forceChangePassword(payload: { old_password: string; new_password: string }) {
  const { data } = await api.post("/core/change-password/", payload);
  return data as { message?: string };
}

export default function ForcePasswordChangeModal({
  onSuccess,
  onDismiss,
}: {
  onSuccess: () => void;
  onDismiss: () => void;
}) {
  const mut = useMutation({ mutationFn: forceChangePassword });
  const dialogRef = useRef<HTMLDivElement>(null);

  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [msg, setMsg] = useState("");
  const ready = isPasswordChangeReady(oldPw, newPw, confirmPw);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current
        ?.querySelector<HTMLInputElement>("#force-current-password")
        ?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, []);

  const submit = async () => {
    setMsg("");
    if (!oldPw) {
      setMsg("현재 또는 받은 임시 비밀번호를 입력해 주세요.");
      return;
    }
    if (!newPw) {
      setMsg("새 비밀번호를 입력해 주세요.");
      return;
    }
    if (newPw.length < 4) {
      setMsg("새 비밀번호는 4자 이상이어야 합니다.");
      return;
    }
    if (newPw !== confirmPw) {
      setMsg("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    if (oldPw === newPw) {
      setMsg("현재 또는 임시 비밀번호와 다른 비밀번호를 입력해 주세요.");
      return;
    }

    try {
      await mut.mutateAsync({ old_password: oldPw, new_password: newPw });
      onSuccess();
    } catch (e: unknown) {
      setMsg(extractApiError(e, "비밀번호 변경에 실패했습니다."));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && !mut.isPending) {
      e.preventDefault();
      onDismiss();
      return;
    }
    if (e.key === "Tab") {
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first && last) {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
      return;
    }
    if (e.key === "Enter" && ready && !mut.isPending) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className={`${styles.overlay} ${styles.passwordOverlay}`}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="force-password-change-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={styles.panel}
      >
        <header className={styles.header}>
          <h2 id="force-password-change-title" className={styles.title}>비밀번호 변경 권장</h2>
          <p className={styles.description}>공용 초기 비밀번호는 다른 사람이 추측할 수 있어요</p>
          <p className={styles.description}>지금 바꾸는 것을 권장하며, 나중에 변경해도 계속 이용할 수 있습니다</p>
        </header>

        <div className={styles.body}>
          <div className="flex flex-col gap-3">
            <div className="space-y-1">
              <label htmlFor="force-current-password" className={styles.fieldLabel}>
                현재/임시 비밀번호
              </label>
              <PasswordInput
                id="force-current-password"
                label="현재/임시 비밀번호"
                inputClassName="ds-input w-full"
                value={oldPw}
                onValueChange={setOldPw}
                placeholder="받은 임시 비밀번호"
                autoComplete="current-password"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="force-new-password" className={styles.fieldLabel}>
                새 비밀번호
              </label>
              <PasswordInput
                id="force-new-password"
                label="새 비밀번호"
                inputClassName="ds-input w-full"
                value={newPw}
                onValueChange={setNewPw}
                placeholder="4자 이상"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="force-confirm-password" className={styles.fieldLabel}>
                새 비밀번호 확인
              </label>
              <PasswordInput
                id="force-confirm-password"
                label="새 비밀번호 확인"
                inputClassName="ds-input w-full"
                value={confirmPw}
                onValueChange={setConfirmPw}
                placeholder="새 비밀번호 확인"
                autoComplete="new-password"
              />
            </div>
            <PasswordChecklist
              password={newPw}
              currentPassword={oldPw}
              confirmation={confirmPw}
            />
            {msg && <p className={styles.error} role="alert">{msg}</p>}
          </div>
        </div>

        <footer className={styles.footer}>
          <Button
            type="button"
            intent="secondary"
            size="md"
            onClick={onDismiss}
            disabled={mut.isPending}
          >
            위험을 이해했고 나중에
          </Button>
          <Button
            type="button"
            intent="primary"
            size="md"
            onClick={submit}
            disabled={mut.isPending || !ready}
            loading={mut.isPending}
          >
            {mut.isPending ? "변경 중…" : "지금 변경"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
