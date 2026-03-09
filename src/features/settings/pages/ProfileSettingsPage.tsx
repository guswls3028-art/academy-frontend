// PATH: src/features/settings/pages/ProfileSettingsPage.tsx
// 설정 > 프로필 — 인라인 편집 (이름, 전화번호)

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiEdit2, FiCheck, FiX } from "react-icons/fi";

import {
  fetchMe,
  updateProfile,
  displayUsername,
  meToStaffRole,
} from "@/features/profile/api/profile.api";
import { StaffRoleAvatar } from "@/shared/ui/avatars";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";

import s from "../components/SettingsSection.module.css";

function roleLabel(role: string): string {
  if (role === "owner") return "대표";
  if (role === "TEACHER") return "강사";
  return "조교";
}

// ── Inline edit group: name + phone ──────────────────────────────────────────
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
      <div className={s.rowLabel} style={{ paddingTop: 4 }}>프로필</div>
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
              style={{ maxWidth: 280 }}
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ProfileSettingsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const meQ = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  const updateMut = useMutation({
    mutationFn: (payload: { name?: string; phone?: string }) =>
      updateProfile(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      feedback.success("저장되었습니다.");
      setEditing(false);
    },
    onError: () => feedback.error("저장에 실패했습니다."),
  });

  if (meQ.isLoading) {
    return (
      <div className={s.page}>
        <div className={s.loadingBox}>불러오는 중…</div>
      </div>
    );
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
      {/* ── Section header ── */}
      <div className={s.sectionHeader}>
        <h2 className={s.sectionTitle}>프로필</h2>
        <p className={s.sectionDescription}>개인 계정 정보를 확인하고 수정할 수 있습니다.</p>
      </div>

      {/* ── Rows ── */}
      <section className={s.section}>
        <div className={s.rows}>
          {/* Avatar row */}
          <div className={s.avatarRow}>
            <div
              className={s.avatarCircle}
              aria-hidden
            >
              <StaffRoleAvatar role={role} size={26} className="text-[var(--color-primary)]" />
            </div>
            <div className={s.avatarInfo}>
              <span className={s.avatarName}>{me.name || me.username}</span>
              <div className={s.avatarMeta}>
                <span className={s.avatarRole}>{roleLabel(role)}</span>
              </div>
            </div>
          </div>

          {/* Inline edit group or display rows */}
          {editing ? (
            <ProfileEditGroup
              initialName={me.name ?? ""}
              initialPhone={me.phone ?? ""}
              onSave={async (name, phone) => {
                await updateMut.mutateAsync({
                  name: name || undefined,
                  phone: phone || undefined,
                });
              }}
              onCancel={() => setEditing(false)}
              saving={updateMut.isPending}
            />
          ) : (
            <>
              {/* Name */}
              <div className={s.row}>
                <span className={s.rowLabel}>이름</span>
                <span className={me.name ? s.rowValue : s.rowValueMuted}>
                  {me.name || "미설정"}
                </span>
                <div className={s.rowActions}>
                  <button className={s.editBtn} onClick={() => setEditing(true)} type="button">
                    <FiEdit2 size={12} aria-hidden />
                    수정
                  </button>
                </div>
              </div>

              {/* Phone */}
              <div className={s.row}>
                <span className={s.rowLabel}>전화번호</span>
                <span className={me.phone ? s.rowValue : s.rowValueMuted}>
                  {me.phone || "미설정"}
                </span>
                <div className={s.rowActions}>
                  <button className={s.editBtn} onClick={() => setEditing(true)} type="button">
                    <FiEdit2 size={12} aria-hidden />
                    수정
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Account ID — readonly */}
          <div className={s.row}>
            <span className={s.rowLabel}>계정 ID</span>
            <span className={s.rowValue} style={{ fontFamily: "monospace", fontSize: 13 }}>
              {displayId || "—"}
            </span>
            <div className={s.rowActions}>
              <span className={s.readonlyBadge}>변경 불가</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
