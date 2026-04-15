import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import api from "@/shared/api/axios";

const inputCls = "ds-input w-full";

async function forceChangePassword(payload: { old_password: string; new_password: string }) {
  const { data } = await api.post("/core/change-password/", payload);
  return data as { message?: string };
}

export default function ForcePasswordChangeModal({
  onSuccess,
}: {
  onSuccess: () => void;
}) {
  const mut = useMutation({ mutationFn: forceChangePassword });

  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [msg, setMsg] = useState("");

  const submit = async () => {
    setMsg("");
    if (!oldPw) {
      setMsg("현재 비밀번호를 입력해 주세요.");
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
      setMsg("현재 비밀번호와 다른 비밀번호를 입력해 주세요.");
      return;
    }

    try {
      await mut.mutateAsync({ old_password: oldPw, new_password: newPw });
      onSuccess();
    } catch (e: unknown) {
      const detail =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setMsg(detail || "비밀번호 변경에 실패했습니다.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !mut.isPending) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onKeyDown={handleKeyDown}
        style={{
          width: 380,
          maxWidth: "90vw",
          background: "var(--color-modal-bg, #fff)",
          borderRadius: 16,
          border: "1px solid var(--color-border-divider, #e5e7eb)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                display: "grid",
                placeItems: "center",
                background: "color-mix(in srgb, var(--color-brand-primary, #3b82f6) 12%, var(--color-modal-bg, #fff))",
                border: "1px solid var(--color-border-divider, #e5e7eb)",
                color: "var(--color-brand-primary, #3b82f6)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary, #111)" }}>
                비밀번호 변경
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted, #888)", marginTop: 2 }}>
                보안을 위해 초기 비밀번호를 변경해 주세요
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 24px 20px" }}>
          <div className="flex flex-col gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-secondary, #666)" }}>
                현재 비밀번호
              </label>
              <input
                type="password"
                className={inputCls}
                value={oldPw}
                onChange={(e) => setOldPw(e.target.value)}
                placeholder="현재 비밀번호"
                autoComplete="current-password"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-secondary, #666)" }}>
                새 비밀번호
              </label>
              <input
                type="password"
                className={inputCls}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="4자 이상"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-secondary, #666)" }}>
                새 비밀번호 확인
              </label>
              <input
                type="password"
                className={inputCls}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="새 비밀번호 확인"
                autoComplete="new-password"
              />
            </div>
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
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid var(--color-border-divider, #e5e7eb)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
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
        </div>
      </div>
    </div>
  );
}
