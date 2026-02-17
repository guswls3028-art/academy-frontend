// PATH: src/features/profile/account/components/ProfileInfoCard.tsx
// 내 정보 — 모달 SSOT 톤 카드(명함 스타일), 수정 모달, 비밀번호/로그아웃 푸터

import { useState } from "react";
import { FiEdit2, FiKey, FiLogOut, FiUser } from "react-icons/fi";
import { Button } from "@/shared/ui/ds";
import { StaffRoleAvatar, type StaffRoleType } from "@/shared/ui/avatars";
import { Me } from "../../api/profile.api";
import ProfileEditModal from "./ProfileEditModal";

const VALUE_COLOR = "var(--color-text-primary)";
const MUTED_COLOR = "var(--color-text-muted)";
const SECONDARY_COLOR = "var(--color-text-secondary)";

/** Me → 직원관리와 동일한 역할 아이콘 매핑 (is_superuser=대표, is_staff=강사, 그 외 조교) */
function meToStaffRole(me: Me): StaffRoleType {
  if (me.is_superuser) return "owner";
  if (me.is_staff) return "TEACHER";
  return "ASSISTANT";
}

function roleLabel(role: StaffRoleType): string {
  if (role === "owner") return "대표";
  if (role === "TEACHER") return "강사";
  return "조교";
}

export default function ProfileInfoCard({
  me,
  onSave,
  saving,
  onPasswordClick,
  onLogout,
}: {
  me: Me;
  onSave: (payload: { name?: string; phone?: string }) => Promise<void>;
  saving?: boolean;
  onPasswordClick?: () => void;
  onLogout?: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const role = meToStaffRole(me);

  const handleSaveFromModal = async (payload: { name: string; phone: string }) => {
    await onSave({
      name: payload.name || undefined,
      phone: payload.phone || undefined,
    });
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* 모달 SSOT 톤 카드 — 셸·헤더·본문·푸터 */}
        <div className="ds-card-modal">
          <header className="ds-card-modal__header">
            <div aria-hidden className="ds-card-modal__accent" />
            <div className="ds-card-modal__header-inner">
              <div
                className="ds-card-modal__header-icon"
                style={{ color: "var(--color-brand-primary)" }}
                aria-hidden
              >
                <FiUser size={16} strokeWidth={2} />
              </div>
              <div className="ds-card-modal__header-text">
                <div className="ds-card-modal__header-title">내 정보</div>
                <div className="ds-card-modal__header-description">
                  계정 정보를 확인하고 수정할 수 있습니다.
                </div>
              </div>
            </div>
            <div className="ds-card-modal__header-right">
              <Button
                type="button"
                intent="secondary"
                size="md"
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-2"
                leftIcon={<FiEdit2 size={14} />}
              >
                수정
              </Button>
            </div>
          </header>

          <div className="ds-card-modal__body">
            <div className="modal-form-group" style={{ display: "block", flexDirection: "unset", gap: 0 }}>
              <div
                className="flex flex-wrap items-center gap-4"
                style={{ padding: 0 }}
              >
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: "color-mix(in srgb, var(--color-brand-primary) 14%, var(--color-bg-surface))",
                    color: "var(--color-primary)",
                  }}
                  aria-hidden
                >
                  <StaffRoleAvatar role={role} size={28} className="text-[var(--color-primary)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="font-semibold tracking-tight"
                      style={{ fontSize: "var(--text-xl)", color: VALUE_COLOR }}
                    >
                      {me.name || me.username}
                    </span>
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{
                        background:
                          role === "owner"
                            ? "color-mix(in srgb, var(--color-primary) 18%, transparent)"
                            : "var(--color-bg-surface-soft)",
                        color: role === "owner" ? "var(--color-primary)" : SECONDARY_COLOR,
                      }}
                    >
                      {roleLabel(role)}
                    </span>
                  </div>
                  <div className="mt-1 font-medium" style={{ fontSize: "var(--text-sm)", color: SECONDARY_COLOR }}>
                    아이디 {me.username}
                  </div>
                  {me.phone && (
                    <div className="mt-0.5 font-medium" style={{ fontSize: "var(--text-sm)", color: MUTED_COLOR }}>
                      {me.phone}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 푸터 — 모달 footer와 동일 톤 (계정·보안) */}
          {(onPasswordClick != null || onLogout != null) && (
            <div className="ds-card-modal__footer">
              <span className="text-[var(--text-sm)] font-medium" style={{ color: MUTED_COLOR }}>
                계정 · 보안
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {onPasswordClick != null && (
                  <Button
                    type="button"
                    intent="secondary"
                    size="md"
                    onClick={onPasswordClick}
                    className="inline-flex items-center gap-2"
                    leftIcon={<FiKey size={14} />}
                  >
                    비밀번호 변경
                  </Button>
                )}
                {onLogout != null && (
                  <Button
                    type="button"
                    intent="danger"
                    size="md"
                    onClick={onLogout}
                    className="inline-flex items-center gap-2"
                    leftIcon={<FiLogOut size={14} />}
                  >
                    로그아웃
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ProfileEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialName={me.name ?? ""}
        initialPhone={me.phone ?? ""}
        onSave={handleSaveFromModal}
        saving={saving}
      />
    </>
  );
}
