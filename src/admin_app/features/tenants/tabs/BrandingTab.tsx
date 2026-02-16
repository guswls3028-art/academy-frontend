// PATH: src/admin_app/features/tenants/tabs/BrandingTab.tsx
// 로고 업로드 + 표시 이름, 브라우저/로그인 타이틀

type Props = {
  tenantId: number;
  tenantName: string;
  logoUrl: string | null;
  displayName: string;
  windowTitle: string;
  loginTitle: string;
  loginSubtitle: string;
  uploading: boolean;
  onLogoChange: (file: File) => void;
  onDisplayNameChange: (v: string) => void;
  onWindowTitleChange: (v: string) => void;
  onLoginTitleChange: (v: string) => void;
  onLoginSubtitleChange: (v: string) => void;
  onSave: () => void;
};

export default function BrandingTab({
  tenantId,
  tenantName,
  logoUrl,
  displayName,
  windowTitle,
  loginTitle,
  loginSubtitle,
  uploading,
  onLogoChange,
  onDisplayNameChange,
  onWindowTitleChange,
  onLoginTitleChange,
  onLoginSubtitleChange,
  onSave,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-2">
          로고
        </label>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${tenantName} logo`}
              className="h-20 w-auto object-contain border border-slate-200 rounded-lg"
            />
          ) : (
            <div className="h-20 w-28 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400 text-xs bg-slate-50">
              No logo
            </div>
          )}
          <div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              id={`logo-${tenantId}`}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onLogoChange(f);
                e.target.value = "";
              }}
            />
            <label
              htmlFor={`logo-${tenantId}`}
              className="inline-block px-3 py-2 bg-slate-700 text-white text-sm rounded-lg cursor-pointer hover:bg-slate-600 disabled:opacity-50"
            >
              {uploading ? "업로드 중…" : "Upload logo"}
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-1">
            표시 이름 (헤더) *
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            className="ds-input w-full"
            placeholder="예: 박철 과학"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-1">
            브라우저 타이틀
          </label>
          <input
            type="text"
            value={windowTitle}
            onChange={(e) => onWindowTitleChange(e.target.value)}
            className="ds-input w-full"
            placeholder="비워두면 표시 이름 사용"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-1">
            로그인 타이틀
          </label>
          <input
            type="text"
            value={loginTitle}
            onChange={(e) => onLoginTitleChange(e.target.value)}
            className="ds-input w-full"
            placeholder="로그인 화면 상단 문구"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-1">
            로그인 서브타이틀
          </label>
          <input
            type="text"
            value={loginSubtitle}
            onChange={(e) => onLoginSubtitleChange(e.target.value)}
            className="ds-input w-full"
            placeholder="로그인 화면 하단 문구"
          />
        </div>
        <button
          type="button"
          onClick={onSave}
          className="ds-button"
          data-intent="primary"
          data-size="md"
        >
          모든 설정 저장
        </button>
      </div>
    </div>
  );
}
