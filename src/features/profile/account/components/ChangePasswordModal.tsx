import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/shared/ui/card";
import { useMutation } from "@tanstack/react-query";
import { changePassword } from "../../api/profile.api";

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
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

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
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || "비밀번호 변경 실패");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-[420px]">
        <Card className="overflow-hidden rounded-xl">
          <CardHeader title="비밀번호 변경" />

          <CardBody className="space-y-4 text-sm">
            {/* 안내 */}
            <div className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3">
              <div className="text-xs leading-relaxed text-[var(--text-muted)]">
                <b>현재 비밀번호</b>를 입력한 뒤  
                새 비밀번호로 변경해 주세요.
              </div>
            </div>

            {/* 입력 영역 */}
            <div className="space-y-4 rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] p-4">
              <Field label="현재 비밀번호">
                <input
                  type="password"
                  className="
                    w-full
                    rounded-lg
                    border border-[var(--border-divider)]
                    bg-[var(--bg-surface)]
                    px-3 py-2
                    text-sm
                    outline-none
                    focus:border-[var(--color-primary)]
                  "
                  value={oldPw}
                  onChange={(e) => setOldPw(e.target.value)}
                />
              </Field>

              <Field label="새 비밀번호">
                <input
                  type="password"
                  className="
                    w-full
                    rounded-lg
                    border border-[var(--border-divider)]
                    bg-[var(--bg-surface)]
                    px-3 py-2
                    text-sm
                    outline-none
                    focus:border-[var(--color-primary)]
                  "
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                />
              </Field>
            </div>

            {/* 에러 */}
            {msg && (
              <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
                {msg}
              </div>
            )}

            {/* 버튼 */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                className="
                  h-[44px]
                  rounded-lg
                  border border-[var(--border-divider)]
                  bg-[var(--bg-surface)]
                  text-sm font-semibold
                  text-[var(--text-primary)]
                  hover:bg-[var(--bg-surface-soft)]
                "
                onClick={onClose}
              >
                취소
              </button>

              <button
                className="
                  h-[44px]
                  rounded-lg
                  border border-[var(--color-primary)]
                  bg-[var(--color-primary)]
                  text-sm font-semibold
                  text-white
                  hover:brightness-95
                  disabled:border-[var(--border-divider)]
                  disabled:bg-[var(--bg-surface)]
                  disabled:text-[var(--text-muted)]
                  disabled:cursor-not-allowed
                "
                onClick={submit}
                disabled={mut.isPending}
              >
                {mut.isPending ? "변경중..." : "비밀번호 변경"}
              </button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-[var(--text-muted)]">
        {label}
      </div>
      {children}
    </div>
  );
}
