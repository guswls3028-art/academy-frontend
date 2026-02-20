// PATH: src/dev_app/pages/TenantAdvancedPage.tsx
// 고급 설정 — isActive 토글 연동

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getTenants, updateTenant, type TenantDto } from "@/dev_app/api/tenants";
import AdminToast from "@/dev_app/components/AdminToast";
import "@/styles/design-system/index.css";

export default function TenantAdvancedPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<TenantDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);

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

  const handleToggleActive = async () => {
    if (!tenant) return;
    setToggling(true);
    setToast(null);
    try {
      await updateTenant(tenant.id, { isActive: !tenant.isActive });
      setTenant((t) => (t ? { ...t, isActive: !t.isActive } : t));
      setToast({ message: tenant.isActive ? "비활성화되었습니다." : "활성화되었습니다.", kind: "success" });
    } catch {
      setToast({ message: "상태 변경에 실패했습니다.", kind: "error" });
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="pb-24">
        <div className="mb-6 h-6 w-24 rounded bg-slate-100 animate-pulse" />
        <div className="h-20 rounded-xl bg-slate-100 animate-pulse" />
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

  return (
    <div className="pb-24">
      <AdminToast message={toast?.message ?? ""} kind={toast?.kind ?? "success"} visible={!!toast} onClose={() => setToast(null)} />
      <div className="mb-6">
        <button type="button" onClick={() => navigate(`/dev/branding/${tenant.id}`)} className="text-sm text-slate-600 mb-2 flex items-center gap-1">
          ← 설정
        </button>
        <h1 className="text-xl font-bold text-slate-900">고급 설정</h1>
        <p className="text-sm text-slate-500">{tenant.name}</p>
      </div>
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between min-h-[48px] gap-3">
          <span className="font-medium text-slate-900">테넌트 상태</span>
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={toggling}
            className={`relative inline-flex h-8 w-14 shrink-0 rounded-full border-2 transition-colors min-h-[48px] min-w-[56px] ${
              tenant.isActive ? "bg-emerald-500 border-emerald-500" : "bg-slate-200 border-slate-200"
            }`}
            role="switch"
            aria-checked={tenant.isActive}
          >
            <span
              className={`inline-block h-7 w-7 rounded-full bg-white shadow transform transition-transform ${
                tenant.isActive ? "translate-x-7" : "translate-x-0.5"
              }`}
              style={{ marginTop: 2 }}
            />
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">{tenant.isActive ? "활성: 로그인·가입 가능" : "비활성: 신규 접속 제한"}</p>
      </div>
    </div>
  );
}
