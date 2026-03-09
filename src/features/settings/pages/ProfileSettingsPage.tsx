// PATH: src/features/settings/pages/ProfileSettingsPage.tsx
// 설정 > 프로필 + 보안 — 인라인 편집 통합 페이지

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiEdit2, FiCheck, FiX, FiLock, FiLogOut } from "react-icons/fi";

import {
  fetchMe,
  updateProfile,
  changePassword,
  displayUsername,
  meToStaffRole,
} from "@/features/profile/api/profile.api";
import useAuth from "@/features/auth/hooks/useAuth";
import { StaffRoleAvatar } from "@/shared/ui/avatars";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";

import s from "../components/SettingsSection.module.css";

function roleLabel(role: string): string {
  if (role === "owner") return "대표";
  if (role === "TEACHER") return "강사";
  return "조교";
}

// ── Profile inline edit group ─────────────────────────────────────────────────
function ProfileEditGroup({
  initialName,
  initialPhone,
  onSave,
  onCancel,
  saving,
}: {
  initialName: string;
  initialPhone: string;
  onSave: (name: string, phone: string) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);

  return (
    <div className={s.rowEdit}>
      <div className={s.rowLabel} style={{ paddingTop: 6 }}>프로필</div>
      <div className={s.rowEditRight}>
        <div className={s.rowEditInputs}>
          <div>
            <p className={s.fieldLabel}>이름</p>
            <input
              type="text"
              className="ds-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름"
              aria-label="이름"
              disabled={saving}
              style={{ maxWidth: 260 }}
            />
          </div>
          <div>
            <p className={s.fieldLabel}>전화번호</p>
            <input
              type="tel"
              className="ds-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-xxxx-xxxx"
              aria-label="전화번호"
              disabled={saving}
              style={{ maxWidth: 200 }}
            />
          </div>
        </div>
        <div className={s.rowEditActions}>
          <Button
            type="button"
            intent="primary"
            size="sm"
            onClick={() => onSave(name.trim(), phone.trim())}
            disabled={saving}
            loading={saving}
            leftIcon={saving ? undefined : <FiCheck size={13} />}
          >
            {saving ? "저장 중…" : "저장"}
          </Button>
          <Button type="button" intent="ghost" size="sm" onClick={onCancel} disabled={saving} leftIcon={<FiX size={13} />}>
            취소
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Password inline change ────────────────────────────────────────────────────
function PasswordChangeGroup({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");

  const mut = useMutation({ mutationFn: changePassword });

  const handleSubmit = async () => {
    setError("");
    if (!oldPw || !newPw) { setError("현재 비밀번호와 새 비밀번호를 모두 입력하세요."); return; }
    if (newPw !== confirmPw) { setError("새 비밀번호가 일치하지 않습니다."); return; }
    if (newPw.length < 8) { setError("새 비밀번호는 8자 이상이어야 합니다."); return; }
    try {
      await mut.mutateAsync({ old_password: oldPw, new_password: newPw });
      feedback.success("비밀번호가 변경되었습니다.");
      onDone();
    } catch (e: unknown) {
      const detail =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setError(detail || "비밀번호 변경에 실패했습니다.");
    }
  };

  return (
    <div className={s.rowEdit}>
      <div className={s.rowLabel} style={{ paddingTop: 6 }}>비밀번호</div>
      <div className={s.rowEditRight}>
        <div className={s.rowEditInputs}>
          <div>
            <p className={s.fieldLabel}>현재 비밀번호</p>
            <input type="password" className="ds-input" value={oldPw} onChange={(e) => setOldPw(e.target.value)}
              placeholder="현재 비밀번호" aria-label="현재 비밀번호" autoComplete="current-password"
              disabled={mut.isPending} style={{ maxWidth: 260 }} />
          </div>
          <div>
            <p className={s.fieldLabel}>새 비밀번호</p>
            <input type="password" className="ds-input" value={newPw} onChange={(e) => setNewPw(e.target.value)}
              placeholder="8자 이상" aria-label="새 비밀번호" autoComplete="new-password"
              disabled={mut.isPending} style={{ maxWidth: 260 }} />
          </div>
          <div>
            <p className={s.fieldLabel}>새 비밀번호 확인</p>
            <input type="password" className="ds-input" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="새 비밀번호 재입력" aria-label="새 비밀번호 확인" autoComplete="new-password"
              disabled={mut.isPending} style={{ maxWidth: 260 }} />
          </div>
        </div>

        {error && (
          <div style={{
            fontSize: 13, fontWeight: 600, color: "var(--color-error)",
            background: "color-mix(in srgb, var(--color-error) 8%, var(--color-bg-surface))",
            border: "1px solid color-mix(in srgb, var(--color-error) 20%, var(--color-border-divider))",
            borderRadius: 6, padding: "8px 12px",
          }}>
            {error}
          </div>
        )}

        <div className={s.rowEditActions}>
          <Button type="button" intent="primary" size="sm" onClick={handleSubmit}
            disabled={mut.isPending} loading={mut.isPending}
            leftIcon={mut.isPending ? undefined : <FiCheck size={13} />}>
            {mut.isPending ? "변경 중…" : "변경"}
          </Button>
          <Button type="button" intent="ghost" size="sm" onClick={onCancel} disabled={mut.isPending} leftIcon={<FiX size={13} />}>
            취소
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ProfileSettingsPage() {
  const qc = useQueryClient();
  const { clearAuth } = useAuth();

  const [editingProfile, setEditingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const meQ = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  const updateMut = useMutation({
    mutationFn: (payload: { name?: string; phone?: string }) => updateProfile(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      feedback.success("저장되었습니다.");
      setEditingProfile(false);
    },
    onError: () => feedback.error("저장에 실패했습니다."),
  });

  if (meQ.isLoading) {
    return <div className={s.page}><div className={s.loadingBox}>불러오는 중…</div></div>;
  }

  if (meQ.isError || !meQ.data) {
    return (
      <div className={s.page}>
        <div className={s.loadingBox} style={{ borderStyle: "solid", color: "var(--color-error)" }}>
          내 정보를 불러올 수 없습니다.
        </div>
      </div>
    );
  }

  const me = meQ.data;
  const role = meToStaffRole(me);
  const displayId = displayUsername(me.username);

  return (
    <div className={s.page}>

      {/* ── 프로필 섹션 ── */}
      <section className={s.section}>
        <div className={s.sectionHeader}>
          <h2 className={s.sectionTitle}>프로필</h2>
          <p className={s.sectionDescription}>개인 계정 정보를 확인하고 수정할 수 있습니다.</p>
        </div>
        <div className={s.rows}>
          {/* Avatar */}
          <div className={s.avatarRow}>
            <div className={s.avatarCircle} aria-hidden>
              <StaffRoleAvatar role={role} size={26} className="text-[var(--color-primary)]" />
            </div>
            <div className={s.avatarInfo}>
              <span className={s.avatarName}>{me.name || me.username}</span>
              <div className={s.avatarMeta}>
                <span className={s.avatarRole}>{roleLabel(role)}</span>
              </div>
            </div>
          </div>

          {/* Name + Phone — inline edit or display */}
          {editingProfile ? (
            <ProfileEditGroup
              initialName={me.name ?? ""}
              initialPhone={me.phone ?? ""}
              onSave={async (name, phone) => {
                await updateMut.mutateAsync({ name: name || undefined, phone: phone || undefined });
              }}
              onCancel={() => setEditingProfile(false)}
              saving={updateMut.isPending}
            />
          ) : (
            <>
              <div className={s.row}>
                <span className={s.rowLabel}>이름</span>
                <span className={me.name ? s.rowValue : s.rowValueMuted}>{me.name || "미설정"}</span>
                <div className={s.rowActions}>
                  <button className={s.editBtn} onClick={() => setEditingProfile(true)} type="button">
                    <FiEdit2 size={11} aria-hidden />수정
                  </button>
                </div>
              </div>
              <div className={s.row}>
                <span className={s.rowLabel}>전화번호</span>
                <span className={me.phone ? s.rowValue : s.rowValueMuted}>{me.phone || "미설정"}</span>
                <div className={s.rowActions}>
                  <button className={s.editBtn} onClick={() => setEditingProfile(true)} type="button">
                    <FiEdit2 size={11} aria-hidden />수정
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Account ID — readonly */}
          <div className={s.row}>
            <span className={s.rowLabel}>계정 ID</span>
            <span className={s.rowValue} style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 600 }}>
              {displayId || "—"}
            </span>
            <div className={s.rowActions}>
              <span className={s.readonlyBadge}>변경 불가</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 보안 섹션 ── */}
      <section className={s.section}>
        <div className={s.sectionHeader}>
          <h2 className={s.sectionTitle}>보안</h2>
          <p className={s.sectionDescription}>비밀번호 변경 및 로그인 관리.</p>
        </div>
        <div className={s.rows}>
          {/* Password */}
          {changingPassword ? (
            <PasswordChangeGroup
              onDone={() => setChangingPassword(false)}
              onCancel={() => setChangingPassword(false)}
            />
          ) : (
            <div className={s.dangerRow}>
              <div className={s.dangerRowLeft}>
                <span className={s.dangerRowTitle}>
                  <FiLock size={12} style={{ marginRight: 5, verticalAlign: "middle", opacity: 0.6 }} aria-hidden />
                  비밀번호 변경
                </span>
                <span className={s.dangerRowDesc}>현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다.</span>
              </div>
              <button className={s.editBtn} onClick={() => setChangingPassword(true)} type="button">
                변경
              </button>
            </div>
          )}

          {/* Logout */}
          <div className={s.dangerRow}>
            <div className={s.dangerRowLeft}>
              <span className={s.dangerRowTitle}>
                <FiLogOut size={12} style={{ marginRight: 5, verticalAlign: "middle", opacity: 0.6 }} aria-hidden />
                로그아웃
              </span>
              <span className={s.dangerRowDesc}>현재 기기에서 로그아웃합니다.</span>
            </div>
            <Button type="button" intent="danger" size="sm" onClick={clearAuth}>
              로그아웃
            </Button>
          </div>
        </div>
      </section>

    </div>
  );
}
