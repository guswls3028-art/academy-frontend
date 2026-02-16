// PATH: src/admin_app/pages/TenantDomainsPage.tsx
// 도메인 관리 — 목록 표시 (추후 추가/삭제 API 연동)

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getTenants } from "@/admin_app/api/tenants";
import type { TenantDto } from "@/admin_app/api/tenants";
import "@/styles/design-system/index.css";

export default function TenantDomainsPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<TenantDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = tenantId ? parseInt(tenantId, 10) : NaN;
    if (!tenantId || isNaN(id)) {
      setLoading(false);
      return;
    }
    getTenants()
      .then((list) => setTenant(list.find((x) => x.id === id) ?? null))
      .catch(() => setTenant(null))
      .finally(() => setLoading(false));
  }, [tenantId]);

  if (loading) {
    return (
      <div className="pb-24">
        <div className="mb-6 h-6 w-24 rounded bg-slate-100 animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }
  if (!tenant) {
    return (
      <div className="pb-24 flex items-center justify-center min-h-[40vh]">
        <div className="text-slate-500">테넌트를 찾을 수 없습니다.</div>
      </div>
    );
  }

  const domains = tenant.domains?.length ? tenant.domains : tenant.primaryDomain ? [tenant.primaryDomain] : [];

  return (
    <div className="pb-24">
      <div className="mb-6">
        <button type="button" onClick={() => navigate(`/dev/branding/${tenant.id}`)} className="text-sm text-slate-600 mb-2 flex items-center gap-1">
          ← 설정
        </button>
        <h1 className="text-xl font-bold text-slate-900">도메인</h1>
        <p className="text-sm text-slate-500">{tenant.name}</p>
      </div>
      {domains.length === 0 ? (
        <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-slate-500 text-sm">
          등록된 도메인이 없습니다.
        </div>
      ) : (
        <ul className="space-y-2">
          {domains.map((host) => (
            <li key={host} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm min-h-[56px]">
              <span className="font-medium text-slate-900">{host}</span>
              <span className="text-xs text-emerald-600">Active · SSL</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
