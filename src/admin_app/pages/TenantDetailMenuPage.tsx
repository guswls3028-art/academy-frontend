// PATH: src/admin_app/pages/TenantDetailMenuPage.tsx
// Tenant 상세 — 메뉴 카드 + 상단에서 바로 Owner 입력 (탭 없이, 작업 느낌)

import { useState, useEffect, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { getTenants, getTenantOwners, removeTenantOwner, updateTenantOwner, type TenantDto, type TenantOwnerDto } from "@/admin_app/api/tenants";
import OwnerFormCompact from "@/admin_app/components/OwnerFormCompact";
import "@/styles/design-system/index.css";
import "@/styles/design-system/ds/input.css";

export default function TenantDetailMenuPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<TenantDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [owners, setOwners] = useState<TenantOwnerDto[]>([]);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [removingId, setRemovingId] = useState<number | null>(null);

  const loadTenant = useCallback(() => {
    const id = tenantId ? parseInt(tenantId, 10) : NaN;
    if (!tenantId || isNaN(id)) { setLoading(false); return; }
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

  const loadOwners = useCallback(() => {
    const id = tenantId ? parseInt(tenantId, 10) : NaN;
    if (!tenantId || isNaN(id)) return;
    getTenantOwners(id).then(setOwners).catch(() => setOwners([]));
  }, [tenantId]);

  useEffect(() => { loadTenant(); }, [loadTenant]);
  useEffect(() => { loadOwners(); }, [loadOwners]);

  if (loading) {
    return (
      <div className="pb-24">
        <div className="mb-6 h-6 w-20 rounded bg-slate-100 animate-pulse" />
        <div className="h-12 rounded-lg bg-slate-100 animate-pulse mb-2" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
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

  const id = tenant.id;
  const base = `/dev/branding/${id}`;

  return (
    <div className="pb-24">
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

      {/* 바로 보이는 메뉴 카드 */}
      <nav className="space-y-2 mb-6">
        <Link to={`${base}/branding`} className="flex items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm min-h-[56px] active:bg-slate-50">
          <div>
            <div className="font-semibold text-slate-900">브랜딩 설정</div>
            <div className="text-sm text-slate-500">로고, 로그인 문구</div>
          </div>
          <span className="text-slate-400" aria-hidden>›</span>
        </Link>
        <Link to={`${base}/domains`} className="flex items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm min-h-[56px] active:bg-slate-50">
          <div>
            <div className="font-semibold text-slate-900">도메인 관리</div>
            <div className="text-sm text-slate-500">커스텀 도메인</div>
          </div>
          <span className="text-slate-400" aria-hidden>›</span>
        </Link>
        <Link to={`${base}/advanced`} className="flex items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm min-h-[56px] active:bg-slate-50">
          <div>
            <div className="font-semibold text-slate-900">고급 설정</div>
            <div className="text-sm text-slate-500">상태, 메타</div>
          </div>
          <span className="text-slate-400" aria-hidden>›</span>
        </Link>
      </nav>

      {/* Owner — 상세에서 바로 입력 (탭 없음) */}
      <section className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="mb-3 p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
          이 계정은 <strong>{tenant.name}</strong> 전용입니다. 다른 테넌트에서는 로그인할 수 없습니다.
        </div>
        <h3 className="text-sm font-semibold text-slate-900 mb-2">👤 Owner 계정 ({owners.length}명)</h3>
        {owners.length === 0 ? (
          <p className="text-sm text-slate-500 mb-3">등록된 Owner가 없습니다.</p>
        ) : (
          <ul className="space-y-1.5 mb-4">
            {owners.map((o) => (
              <li key={o.userId} className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-lg bg-slate-50 border border-slate-100">
                {editingUserId === o.userId ? (
                  <>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="text-sm font-medium text-slate-900">{o.username}</div>
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="이름" className="ds-input w-full py-2 rounded-lg text-sm min-h-[44px]" />
                      <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="전화" className="ds-input w-full py-2 rounded-lg text-sm min-h-[44px]" />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={async () => { await updateTenantOwner(id, o.userId, { name: editName || undefined, phone: editPhone || undefined }); setEditingUserId(null); loadOwners(); }} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm min-h-[44px]">저장</button>
                      <button type="button" onClick={() => setEditingUserId(null)} className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm min-h-[44px]">취소</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="font-medium text-slate-900">{o.username}</span>
                      {o.name ? <span className="text-xs text-slate-500 block">{o.name}</span> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">OWNER</span>
                      <button type="button" onClick={() => { setEditingUserId(o.userId); setEditName(o.name || ""); setEditPhone(o.phone ?? ""); }} className="text-xs text-slate-600 py-1 px-2 rounded min-h-[32px]">수정</button>
                      <button
                        type="button"
                        onClick={async () => { if (!confirm("이 테넌트에서 Owner를 제거할까요?")) return; setRemovingId(o.userId); try { await removeTenantOwner(id, o.userId); loadOwners(); } finally { setRemovingId(null); } }}
                        disabled={removingId === o.userId}
                        className="text-xs text-red-600 py-1 px-2 rounded min-h-[32px] disabled:opacity-50"
                      >
                        {removingId === o.userId ? "제거 중…" : "제거"}
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <OwnerFormCompact
          tenantId={id}
          tenantName={tenant.name}
          showResultBelow={true}
          onSuccess={loadOwners}
        />
      </section>
    </div>
  );
}
