import { FiSave } from "react-icons/fi";
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
    <div
      className="
        w-full
        max-w-[520px]
        border border-[var(--border-divider)]
        bg-[var(--bg-surface)]
        rounded-xl
        overflow-hidden
      "
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border-divider)] bg-[var(--bg-surface-soft)]">
        <div className="text-sm font-semibold text-[var(--text-primary)]">
          계정 정보
        </div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">
          기본 계정 정보를 관리합니다
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col">
        <InfoRow label="아이디">
          <span className="font-medium">{me.username}</span>
        </InfoRow>

        <InfoRow label="권한">
          <span>{me.is_staff ? "관리자" : "일반 사용자"}</span>
        </InfoRow>

        <EditRow label="이름">
          <input
            className="form-input w-full"
            value={name}
            onChange={(e) => onChangeName(e.target.value)}
          />
        </EditRow>

        <EditRow label="전화번호">
          <input
            className="form-input w-full"
            value={phone}
            onChange={(e) => onChangePhone(e.target.value)}
          />
        </EditRow>
      </div>

      {/* Footer */}
      <div
        className="
          flex items-center justify-between
          px-5 py-4
          border-t border-[var(--border-divider)]
          bg-[var(--bg-surface-soft)]
        "
      >
        {/* 상태 텍스트 */}
        <div className="text-xs">
          {dirty ? (
            <span className="font-medium text-[var(--color-primary)]">
              변경사항이 있습니다
            </span>
          ) : (
            <span className="text-[var(--text-muted)]">
              최신 상태입니다
            </span>
          )}
        </div>

        {/* 저장 버튼 */}
        <button
          onClick={onSave}
          disabled={saving || !dirty}
          className="
            inline-flex items-center gap-2
            h-[38px] px-4
            rounded-lg
            font-semibold text-sm
            border
            border-[var(--color-primary)]
            bg-[var(--color-primary)]
            text-white

            hover:brightness-95
            active:translate-y-[1px]

            disabled:bg-[var(--bg-surface)]
            disabled:text-[var(--text-muted)]
            disabled:border-[var(--border-divider)]
            disabled:cursor-not-allowed
            disabled:brightness-100
          "
        >
          <FiSave size={14} />
          {saving ? "저장중..." : "정보 저장"}
        </button>
      </div>
    </div>
  );
}

/* ---------- Sub Components ---------- */

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] px-5 py-4 border-b border-[var(--border-divider)] hover:bg-[var(--bg-surface-soft)]">
      <div className="text-sm text-[var(--text-muted)]">{label}</div>
      <div className="text-sm text-[var(--text-primary)]">
        {children}
      </div>
    </div>
  );
}

function EditRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] px-5 py-4 border-b border-[var(--border-divider)] hover:bg-[var(--bg-surface-soft)]">
      <div className="text-sm text-[var(--text-muted)] pt-2">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}
