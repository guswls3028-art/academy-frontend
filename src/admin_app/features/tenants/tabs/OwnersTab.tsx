// PATH: src/admin_app/features/tenants/tabs/OwnersTab.tsx
// Owner 리스트 먼저 표시, + Owner 추가 시 BottomSheet (부모에서 처리)

import type { TenantOwnerDto } from "@/admin_app/api/tenants";

type Props = {
  tenantName: string;
  owners: TenantOwnerDto[];
  loading?: boolean;
  onAddOwner: () => void;
};

export default function OwnersTab({
  tenantName,
  owners,
  loading = false,
  onAddOwner,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800">
        이 계정은 <strong>{tenantName}</strong> 전용입니다.
        다른 테넌트에서는 로그인할 수 없습니다.
      </div>

      <section className="mb-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          👤 Owner 계정 ({owners.length}명)
        </h3>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : owners.length === 0 ? (
          <>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium mb-3">
              ⚠ Owner 계정이 없습니다.
              <br />
              이 테넌트는 관리자가 로그인할 수 없습니다.
            </div>
            <p className="text-sm text-slate-500 mb-3">등록된 Owner가 없습니다.</p>
          </>
        ) : (
          <ul className="space-y-2 mb-4">
            {owners.map((o) => (
              <li
                key={o.userId}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200"
              >
                <div>
                  <div className="font-medium text-slate-900">{o.username}</div>
                  <div className="text-xs text-slate-500">{o.name || "이름 없음"}</div>
                </div>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                  OWNER
                </span>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onAddOwner}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 font-medium min-h-[48px] hover:bg-slate-50 active:bg-slate-100"
        >
          + Owner 추가
        </button>
      </section>
    </div>
  );
}
