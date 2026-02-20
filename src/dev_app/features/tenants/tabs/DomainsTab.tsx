// PATH: src/dev_app/features/tenants/tabs/DomainsTab.tsx
// 도메인 목록 (Active/SSL 표시). 추후 API 연동 시 추가/삭제/Primary 지정.

import type { TenantDto } from "@/dev_app/api/tenants";

type Props = {
  tenant: TenantDto;
};

export default function DomainsTab({ tenant }: Props) {
  const domains = tenant.domains?.length
    ? tenant.domains
    : tenant.primaryDomain
      ? [tenant.primaryDomain]
      : [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        커스텀 도메인을 이 테넌트에 연결합니다. (도메인 추가/삭제는 추후 API 연동)
      </p>
      {domains.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-slate-500 text-sm">
          등록된 도메인이 없습니다.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden bg-white">
          {domains.map((host) => (
            <li
              key={host}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <span className="font-medium text-slate-900">{host}</span>
              <span className="flex items-center gap-2 text-xs">
                <span className="text-emerald-600">Active</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">SSL enabled</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
