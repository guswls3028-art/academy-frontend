// PATH: src/admin_app/features/tenants/tabs/OverviewTab.tsx
// 테넌트 요약: 상태, 도메인, 기본 정보

import type { TenantDto } from "@/admin_app/api/tenants";

type Props = {
  tenant: TenantDto;
};

export default function OverviewTab({ tenant }: Props) {
  const domains = tenant.domains?.length
    ? tenant.domains
    : tenant.primaryDomain
      ? [tenant.primaryDomain]
      : [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            상태
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-2 w-2 rounded-full ${
                tenant.isActive ? "bg-emerald-500" : "bg-slate-400"
              }`}
              aria-hidden
            />
            <span className="font-medium text-slate-900">
              {tenant.isActive ? "활성" : "비활성"}
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            코드
          </div>
          <div className="font-mono text-slate-900">{tenant.code}</div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          대표 도메인
        </div>
        <div className="font-medium text-slate-900">
          {tenant.primaryDomain || "—"}
        </div>
      </div>

      {domains.length > 0 && (
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            등록 도메인 ({domains.length})
          </div>
          <ul className="space-y-1.5">
            {domains.map((host) => (
              <li
                key={host}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-slate-800">{host}</span>
                <span className="text-xs text-slate-500">Active · SSL</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-xs text-slate-500 pt-2">
        ID: {tenant.id}
      </div>
    </div>
  );
}
