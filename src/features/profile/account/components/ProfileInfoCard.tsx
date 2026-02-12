// PATH: src/features/profile/account/components/ProfileInfoCard.tsx
import { FiSave, FiUser, FiShield, FiPhone } from "react-icons/fi";
import { Button, Panel } from "@/shared/ui/ds";
import { Me } from "../../api/profile.api";

export default function ProfileInfoList({
  me,
  name,
  phone,
  onChangeName,
  onChangePhone,
  onSave,
  saving,
  dirty,
}: {
  me: Me;
  name: string;
  phone: string;
  onChangeName: (v: string) => void;
  onChangePhone: (v: string) => void;
  onSave: () => void;
  saving?: boolean;
  dirty?: boolean;
}) {
  return (
    <Panel variant="primary">
      {/* Header */}
      <div
        style={{
          padding: "var(--space-6)",
          borderBottom: "1px solid var(--color-border-divider)",
          background: "color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-surface-soft))",
        }}
      >
        <div
          style={{
            fontSize: "var(--text-md)",
            fontWeight: "var(--font-title)",
            color: "var(--color-text-primary)",
          }}
        >
          계정 정보
        </div>
        <div
          className="mt-1"
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-muted)",
            fontWeight: "var(--font-meta)",
          }}
        >
          기본 계정 정보를 관리합니다 · 변경사항은 즉시 반영됩니다
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col">
        <InfoRow icon={<FiUser size={16} />} label="아이디">{me.username}</InfoRow>
        <InfoRow
          icon={<FiShield size={16} />}
          label="권한"
        >
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{
              background: me.is_staff
                ? "color-mix(in srgb, var(--color-primary) 15%, transparent)"
                : "var(--color-bg-surface-soft)",
              color: me.is_staff
                ? "var(--color-primary)"
                : "var(--color-text-secondary)",
            }}
          >
            {me.is_staff ? "관리자" : "일반 사용자"}
          </span>
        </InfoRow>

        <EditRow icon={<FiUser size={16} />} label="이름">
          <input
            className="ds-input"
            value={name}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="이름을 입력하세요"
          />
        </EditRow>

        <EditRow icon={<FiPhone size={16} />} label="전화번호">
          <input
            className="ds-input"
            value={phone}
            onChange={(e) => onChangePhone(e.target.value)}
            placeholder="전화번호를 입력하세요"
          />
        </EditRow>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between gap-3"
        style={{
          padding: "var(--space-6)",
          borderTop: "1px solid var(--color-border-divider)",
          background: "var(--color-bg-surface-soft)",
        }}
      >
        <div
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: "var(--font-meta)",
          }}
        >
          {dirty ? (
            <span style={{ color: "var(--color-primary)" }}>
              변경사항이 있습니다
            </span>
          ) : (
            <span style={{ color: "var(--color-text-muted)" }}>
              최신 상태입니다
            </span>
          )}
        </div>

        <Button
          type="button"
          intent="primary"
          size="md"
          onClick={onSave}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-2"
        >
          <FiSave size={14} />
          {saving ? "저장중..." : "정보 저장"}
        </Button>
      </div>
    </Panel>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid grid-cols-[140px_1fr] items-center gap-4 border-b border-[var(--color-border-divider)] px-6 py-4 transition-colors"
      style={{
        borderBottomColor: "color-mix(in srgb, var(--color-border-divider) 35%, transparent)",
      }}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <span style={{ color: "var(--color-text-muted)" }}>{icon}</span>
        )}
        <span
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: "var(--font-title)",
            color: "var(--color-text-secondary)",
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          color: "var(--color-text-primary)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function EditRow({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid grid-cols-[140px_1fr] items-center gap-4 border-b border-[var(--color-border-divider)] px-6 py-4 transition-colors"
      style={{
        borderBottomColor: "color-mix(in srgb, var(--color-border-divider) 35%, transparent)",
      }}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <span style={{ color: "var(--color-text-muted)" }}>{icon}</span>
        )}
        <span
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: "var(--font-title)",
            color: "var(--color-text-secondary)",
          }}
        >
          {label}
        </span>
      </div>
      <div style={{ maxWidth: 400 }}>{children}</div>
    </div>
  );
}
