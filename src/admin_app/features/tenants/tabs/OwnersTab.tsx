// PATH: src/admin_app/features/tenants/tabs/OwnersTab.tsx
// Owner 등록 폼 (사용자명, 비밀번호, 이름, 전화번호)

type OwnerForm = {
  username: string;
  password: string;
  name: string;
  phone: string;
};

type Props = {
  tenantId: number;
  form: OwnerForm;
  onFormChange: (patch: Partial<OwnerForm>) => void;
  onRegister: () => void;
  registering: boolean;
  lastRegisteredUsername: string | null;
};

export default function OwnersTab({
  tenantId,
  form,
  onFormChange,
  onRegister,
  registering,
  lastRegisteredUsername,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Owner 등록</h3>
        {lastRegisteredUsername && (
          <span className="text-xs text-emerald-600 font-medium">
            ✓ {lastRegisteredUsername} 등록됨
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-slate-900 mb-1">
            사용자명 *
          </label>
          <input
            type="text"
            value={form.username}
            onChange={(e) => onFormChange({ username: e.target.value })}
            className="ds-input w-full"
            placeholder="예: admin97"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-900 mb-1">
            비밀번호 *
          </label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => onFormChange({ password: e.target.value })}
            className="ds-input w-full"
            placeholder="비밀번호 입력"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-900 mb-1">
            이름
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => onFormChange({ name: e.target.value })}
            className="ds-input w-full"
            placeholder="예: 홍길동"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-900 mb-1">
            전화번호
          </label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => onFormChange({ phone: e.target.value })}
            className="ds-input w-full"
            placeholder="예: 01012345678"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onRegister}
        disabled={registering}
        className="ds-button"
        data-intent="primary"
        data-size="md"
      >
        {registering ? "등록 중…" : "Owner 등록"}
      </button>
    </div>
  );
}
