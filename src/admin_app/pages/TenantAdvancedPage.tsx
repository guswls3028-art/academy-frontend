// PATH: src/admin_app/pages/TenantAdvancedPage.tsx
// 고급 설정 — 상태 토글 등 (추후 확장)

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getTenants } from "@/admin_app/api/tenants";
import type { TenantDto } from "@/admin_app/api/tenants";
import "@/styles/design-system/index.css";

export default function TenantAdvancedPage() {
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

  if (loading || !tenant) {
    return (
      <div className="pb-24 flex items-center justify-center min-h-[40vh]">
        <div className="text-slate-500">{loading ? "로딩 중..." : "테넌트를 찾을 수 없습니다."}</div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="mb-6">
        <button type="button" onClick={() => navigate(`/dev/branding/${tenant.id}`)} className="text-sm text-slate-600 mb-2 flex items-center gap-1">
          ← 설정
        </button>
        <h1 className="text-xl font-bold text-slate-900">고급 설정</h1>
        <p className="text-sm text-slate-500">{tenant.name}</p>
      </div>
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between min-h-[48px]">
          <span className="font-medium text-slate-900">상태</span>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${tenant.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
            {tenant.isActive ? "활성" : "비활성"}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-2">상태 변경은 추후 API 연동 시 지원됩니다.</p>
      </div>
    </div>
  );
}
