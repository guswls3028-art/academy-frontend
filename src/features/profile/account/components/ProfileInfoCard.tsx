// PATH: src/features/profile/account/components/ProfileInfoCard.tsx
// 내 정보 카드 — 단일 패널, 읽기/수정 구분·프리미엄 톤

import { FiKey, FiLogOut, FiSave, FiPhone, FiUser } from "react-icons/fi";
import { Button, Panel } from "@/shared/ui/ds";
import { Me } from "../../api/profile.api";

const ROW_GAP = "var(--space-5)";
const LABEL_COLOR = "var(--color-text-secondary)";
const LABEL_FONT = "var(--text-sm)";
const VALUE_COLOR = "var(--color-text-primary)";

export default function ProfileInfoCard({
  me,
  name,
  phone,
  onChangeName,
  onChangePhone,
  onSave,
  saving,
  dirty,
  onPasswordClick,
  onLogout,
}: {
  me: Me;
  name: string;
  phone: string;
  onChangeName: (v: string) => void;
  onChangePhone: (v: string) => void;
  onSave: () => void;
  saving?: boolean;
  dirty?: boolean;
  onPasswordClick?: () => void;
  onLogout?: () => void;
}) {
  const initial = (me.name || me.username || "?").charAt(0).toUpperCase();

  return (
    <Panel
      variant="primary"
      title="내 정보"
      description="이름·전화번호를 수정한 뒤 저장하면 반영됩니다."
      right={
        (onPasswordClick != null || onLogout != null) && (
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
        )
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span
            className="text-[var(--text-sm)] font-medium"
            style={{
              color: dirty ? "var(--color-primary)" : "var(--color-text-muted)",
            }}
          >
            {dirty ? "변경사항이 있습니다" : "최신 상태입니다"}
          </span>
          <Button
            type="button"
            intent={dirty ? "primary" : "secondary"}
            size="md"
            onClick={onSave}
            disabled={saving || !dirty}
            loading={saving}
            className="inline-flex items-center gap-2"
            leftIcon={!saving ? <FiSave size={14} /> : undefined}
          >
            {saving ? "저장 중…" : "수정 저장"}
          </Button>
        </div>
      }
    >
      {/* 프로필 요약 — 읽기 전용 */}
      <div
        className="flex flex-wrap items-center gap-4 rounded-xl p-4"
        style={{
          background: "color-mix(in srgb, var(--color-primary) 6%, var(--color-bg-surface-soft))",
          border: "1px solid var(--color-border-divider)",
        }}
      >
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold"
          style={{
            background: "color-mix(in srgb, var(--color-primary) 18%, var(--color-bg-surface))",
            color: "var(--color-primary)",
          }}
          aria-hidden
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="font-semibold tracking-tight"
              style={{ fontSize: "var(--text-lg)", color: VALUE_COLOR }}
            >
              {me.name || me.username}
            </span>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{
                background: me.is_staff
                  ? "color-mix(in srgb, var(--color-primary) 14%, transparent)"
                  : "var(--color-bg-surface-soft)",
                color: me.is_staff ? "var(--color-primary)" : LABEL_COLOR,
              }}
            >
              {me.is_staff ? "관리자" : "일반 사용자"}
            </span>
          </div>
          <div
            className="mt-0.5 font-medium"
            style={{ fontSize: "var(--text-sm)", color: LABEL_COLOR }}
          >
            아이디 {me.username}
          </div>
        </div>
      </div>

      {/* 수정 가능한 필드 */}
      <div style={{ marginTop: ROW_GAP }}>
        <div
          className="mb-3 font-semibold"
          style={{ fontSize: LABEL_FONT, color: LABEL_COLOR }}
        >
          수정할 수 있는 정보
        </div>
        <div
          className="flex flex-col gap-4 rounded-xl p-4"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-divider)",
          }}
        >
          <LabelField label="이름" icon={<FiUser size={14} />}>
            <input
              type="text"
              className="ds-input block w-full max-w-[320px]"
              value={name}
              onChange={(e) => onChangeName(e.target.value)}
              placeholder="이름을 입력하세요"
              aria-label="이름"
            />
          </LabelField>
          <LabelField label="전화번호" icon={<FiPhone size={14} />}>
            <input
              type="tel"
              className="ds-input block w-full max-w-[320px]"
              value={phone}
              onChange={(e) => onChangePhone(e.target.value)}
              placeholder="전화번호를 입력하세요"
              aria-label="전화번호"
            />
          </LabelField>
        </div>
      </div>
    </Panel>
  );
}

function LabelField({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="flex items-center gap-2 font-medium"
        style={{ fontSize: LABEL_FONT, color: LABEL_COLOR }}
      >
        {icon && <span style={{ color: "var(--color-text-muted)" }}>{icon}</span>}
        {label}
      </label>
      {children}
    </div>
  );
}
