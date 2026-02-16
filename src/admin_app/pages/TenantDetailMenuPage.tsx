// PATH: src/admin_app/pages/TenantDetailMenuPage.tsx
// STEP 2: Tenant 상세 메뉴 — 브랜딩/도메인/Owner/고급 > (한 화면에 한 목적)

import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { getTenants, type TenantDto } from "@/admin_app/api/tenants";
import AdminOwnerBottomSheet from "@/admin_app/components/AdminOwnerBottomSheet";
import AdminToast from "@/admin_app/components/AdminToast";
import "@/styles/design-system/index.css";

const MENU_ITEMS = [
  { to: "branding", label: "브랜딩 설정", desc: "로고, 로그인 문구" },
  { to: "domains", label: "도메인 관리", desc: "커스텀 도메인" },
  { label: "Owner 관리", desc: "오너 계정 등록", action: "owner" as const },
  { to: "advanced", label: "고급 설정", desc: "상태, 메타" },
];

export default function TenantDetailMenuPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<TenantDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [ownerSheetOpen, setOwnerSheetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const id = tenantId ? parseInt(tenantId, 10) : NaN;
    if (!tenantId || isNaN(id)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getTenants()
      .then((list) => {
        const t = list.find((x) => x.id === id);
        if (!cancelled && t) setTenant(t);
      })
      .catch(() => { if (!cancelled) setTenant(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenantId]);

  if (loading || !tenant) {
    return (
      <div className="pb-24 flex items-center justify-center min-h-[40vh]">
        {loading ? <div className="text-slate-500">로딩 중...</div> : <div className="text-slate-500">테넌트를 찾을 수 없습니다.</div>}
      </div>
    );
  }

  const id = tenant.id;
  const base = `/dev/branding/${id}`;

  return (
    <div className="pb-24">
      <AdminToast message={toast ?? ""} kind="success" visible={!!toast} onClose={() => setToast(null)} />
      <div className="mb-6">
        <button type="button" onClick={() => navigate("/dev/branding")} className="text-sm text-slate-600 mb-2 flex items-center gap-1">
          ← 목록
        </button>
        <h1 className="text-xl font-bold text-slate-900">{tenant.name}</h1>
        <p className="text-sm text-slate-500">{tenant.code}{tenant.primaryDomain ? ` · ${tenant.primaryDomain}` : ""}</p>
        <span className={`inline-block mt-2 text-xs font-medium px-2 py-1 rounded-full ${tenant.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
          {tenant.isActive ? "활성" : "비활성"}
        </span>
      </div>

      <nav className="space-y-2">
        {MENU_ITEMS.map((item) => {
          if (item.action === "owner") {
            return (
              <button
                key="owner"
                type="button"
                onClick={() => setOwnerSheetOpen(true)}
                className="w-full flex items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm min-h-[56px] text-left active:bg-slate-50"
              >
                <div>
                  <div className="font-semibold text-slate-900">{item.label}</div>
                  <div className="text-sm text-slate-500">{item.desc}</div>
                </div>
                <span className="text-slate-400" aria-hidden>›</span>
              </button>
            );
          }
          const to = `${base}/${item.to}`;
          return (
            <Link
              key={item.to}
              to={to}
              className="flex items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm min-h-[56px] active:bg-slate-50"
            >
              <div>
                <div className="font-semibold text-slate-900">{item.label}</div>
                <div className="text-sm text-slate-500">{item.desc}</div>
              </div>
              <span className="text-slate-400" aria-hidden>›</span>
            </Link>
          );
        })}
      </nav>

      <AdminOwnerBottomSheet
        open={ownerSheetOpen}
        onClose={() => setOwnerSheetOpen(false)}
        tenantId={id}
        tenantName={tenant.name}
        onSuccess={() => setOwnerSheetOpen(false)}
      />
    </div>
  );
}
