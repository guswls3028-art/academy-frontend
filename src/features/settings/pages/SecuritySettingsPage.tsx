// PATH: src/features/settings/pages/SecuritySettingsPage.tsx
// 설정 > 보안 — 비밀번호 변경 인라인 (모달 없이)

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FiCheck, FiX, FiLock, FiLogOut } from "react-icons/fi";

import { changePassword } from "@/features/profile/api/profile.api";
import useAuth from "@/features/auth/hooks/useAuth";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";

import s from "../components/SettingsSection.module.css";

function PasswordChangeForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");

  const mut = useMutation({ mutationFn: changePassword });

  const handleSubmit = async () => {
    setError("");
    if (!oldPw || !newPw) {
      setError("현재 비밀번호와 새 비밀번호를 모두 입력하세요.");
      return;
    }
    if (newPw !== confirmPw) {
      setError("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    if (newPw.length < 8) {
      setError("새 비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    try {
      await mut.mutateAsync({ old_password: oldPw, new_password: newPw });
      feedback.success("비밀번호가 변경되었습니다.");
      onSuccess();
    } catch (e: unknown) {
      const detail =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setError(detail || "비밀번호 변경에 실패했습니다.");
    }
  };

  return (
    <div className={s.rowEdit} style={{ gridTemplateColumns: "160px 1fr" }}>
      <div className={s.rowLabel} style={{ paddingTop: 4 }}>비밀번호 변경</div>
      <div className={s.rowEditRight}>
        <div className={s.rowEditInputs}>
          <div>
            <p className={s.fieldLabel}>현재 비밀번호</p>
            <input
              type="password"
              className="ds-input"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
              placeholder="현재 비밀번호"
              aria-label="현재 비밀번호"
              autoComplete="current-password"
              disabled={mut.isPending}
              style={{ maxWidth: 280 }}
            />
          </div>
          <div>
            <p className={s.fieldLabel}>새 비밀번호</p>
            <input
              type="password"
              className="ds-input"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="8자 이상"
              aria-label="새 비밀번호"
              autoComplete="new-password"
              disabled={mut.isPending}
              style={{ maxWidth: 280 }}
            />
          </div>
          <div>
            <p className={s.fieldLabel}>새 비밀번호 확인</p>
            <input
              type="password"
              className="ds-input"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="새 비밀번호 재입력"
              aria-label="새 비밀번호 확인"
              autoComplete="new-password"
              disabled={mut.isPending}
              style={{ maxWidth: 280 }}
            />
          </div>
        </div>

        {error && (
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-error)",
              background: "color-mix(in srgb, var(--color-error) 10%, var(--color-bg-surface))",
              border: "1px solid color-mix(in srgb, var(--color-error) 25%, var(--color-border-divider))",
              borderRadius: 6,
              padding: "8px 12px",
            }}
          >
            {error}
          </div>
        )}

        <div className={s.rowEditActions}>
          <Button
            type="button"
            intent="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={mut.isPending}
            loading={mut.isPending}
            leftIcon={mut.isPending ? undefined : <FiCheck size={13} />}
          >
            {mut.isPending ? "변경 중…" : "비밀번호 변경"}
          </Button>
          <Button
            type="button"
            intent="ghost"
            size="sm"
            onClick={onCancel}
            disabled={mut.isPending}
            leftIcon={<FiX size={13} />}
          >
            취소
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SecuritySettingsPage() {
  const { clearAuth } = useAuth();
  const [changingPassword, setChangingPassword] = useState(false);

  return (
    <div className={s.page}>
      <div className={s.sectionHeader}>
        <h2 className={s.sectionTitle}>보안</h2>
        <p className={s.sectionDescription}>계정 보안 설정 및 로그인을 관리합니다.</p>
      </div>

      <section className={s.section}>
        <div className={s.rows}>
          {/* Password change */}
          {changingPassword ? (
            <PasswordChangeForm
              onSuccess={() => setChangingPassword(false)}
              onCancel={() => setChangingPassword(false)}
            />
          ) : (
            <div className={s.dangerRow}>
              <div className={s.dangerRowLeft}>
                <span className={s.dangerRowTitle}>
                  <FiLock size={13} style={{ marginRight: 6, verticalAlign: "middle", color: "var(--color-text-muted)" }} aria-hidden />
                  비밀번호 변경
                </span>
                <span className={s.dangerRowDesc}>현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다.</span>
              </div>
              <button
                className={s.editBtn}
                onClick={() => setChangingPassword(true)}
                type="button"
              >
                변경
              </button>
            </div>
          )}

          {/* Logout */}
          <div className={s.dangerRow}>
            <div className={s.dangerRowLeft}>
              <span className={s.dangerRowTitle}>
                <FiLogOut size={13} style={{ marginRight: 6, verticalAlign: "middle", color: "var(--color-text-muted)" }} aria-hidden />
                로그아웃
              </span>
              <span className={s.dangerRowDesc}>현재 기기에서 로그아웃합니다.</span>
            </div>
            <Button
              type="button"
              intent="danger"
              size="sm"
              onClick={clearAuth}
            >
              로그아웃
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
