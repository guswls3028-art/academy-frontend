// PATH: src/dev_app/pages/TenantListPage.tsx
// STEP 1: Tenant 리스트 — 카드형, 48px 터치, 검색, Pull to Refresh, Swipe 액션, 토스트

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getTenants,
  createTenant,
  registerTenantOwner,
  updateTenant,
  type TenantDto,
} from "@/dev_app/api/tenants";
import AdminToast from "@/dev_app/components/AdminToast";
import "@/styles/design-system/index.css";
import "@/styles/design-system/ds/input.css";

const PULL_THRESHOLD = 70;
const SWIPE_REVEAL_PX = 80;

export default function TenantListPage() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTenantCode, setNewTenantCode] = useState("");
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantDomain, setNewTenantDomain] = useState("");
  const [createOwnerWithTenant, setCreateOwnerWithTenant] = useState(false);
  const [newOwnerUsername, setNewOwnerUsername] = useState("");
  const [newOwnerPassword, setNewOwnerPassword] = useState("");
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerPhone, setNewOwnerPhone] = useState("");

  // Pull to refresh
  const [pullY, setPullY] = useState(0);
  const pullStartY = useRef(0);
  const atTop = useRef(true);

  // Swipe
  const [openSwipeId, setOpenSwipeId] = useState<number | null>(null);
  const [swipeDragId, setSwipeDragId] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipeStartX = useRef(0);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const loadTenants = useCallback(async (showRefreshing = true) => {
    try {
      if (showRefreshing) setLoading(true);
      const data = await getTenants();
      setTenants(data);
    } catch (e) {
      setToast({ message: "목록을 불러오는데 실패했습니다.", kind: "error" });
    } finally {
      setLoading(false);
      setPullY(0);
    }
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const filtered = useMemo(() => {
    if (!search.trim()) return tenants;
    const q = search.trim().toLowerCase();
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        (t.primaryDomain && t.primaryDomain.toLowerCase().includes(q))
    );
  }, [tenants, search]);

  const handleCreateTenant = async () => {
    if (!newTenantCode || !newTenantName) {
      setToast({ message: "코드와 이름을 입력해주세요.", kind: "error" });
      return;
    }
    if (createOwnerWithTenant && (!newOwnerUsername || !newOwnerPassword)) {
      setToast({ message: "오너 계정 생성 시 사용자명과 비밀번호는 필수입니다.", kind: "error" });
      return;
    }
    try {
      const tenant = await createTenant({
        code: newTenantCode,
        name: newTenantName,
        domain: newTenantDomain || undefined,
      });
      if (createOwnerWithTenant && newOwnerUsername && newOwnerPassword) {
        try {
          await registerTenantOwner(tenant.id, {
            username: newOwnerUsername,
            password: newOwnerPassword,
            name: newOwnerName || undefined,
            phone: newOwnerPhone || undefined,
          });
          setToast({ message: `테넌트 생성 완료. 오너(${newOwnerUsername}) 등록됨.`, kind: "success" });
        } catch {
          setToast({ message: "테넌트는 생성되었지만 오너 등록에 실패했습니다.", kind: "error" });
        }
      } else {
        setToast({ message: `테넌트 ${newTenantName} 생성 완료.`, kind: "success" });
      }
      setShowCreateForm(false);
      setNewTenantCode("");
      setNewTenantName("");
      setNewTenantDomain("");
      setCreateOwnerWithTenant(false);
      setNewOwnerUsername("");
      setNewOwnerPassword("");
      setNewOwnerName("");
      setNewOwnerPhone("");
      loadTenants();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setToast({ message: "테넌트 생성 실패: " + (err.response?.data?.detail || String(e)), kind: "error" });
    }
  };

  const handleToggleActive = async (tenant: TenantDto) => {
    setOpenSwipeId(null);
    setTogglingId(tenant.id);
    try {
      await updateTenant(tenant.id, { isActive: !tenant.isActive });
      setTenants((prev) => prev.map((t) => (t.id === tenant.id ? { ...t, isActive: !t.isActive } : t)));
      setToast({ message: tenant.isActive ? "비활성화되었습니다." : "활성화되었습니다.", kind: "success" });
    } catch (e) {
      setToast({ message: "상태 변경에 실패했습니다.", kind: "error" });
    } finally {
      setTogglingId(null);
    }
  };

  const onPullStart = (e: React.TouchEvent) => {
    const scrollTop = typeof window !== "undefined" ? window.scrollY : 0;
    atTop.current = scrollTop <= 2;
    pullStartY.current = e.touches[0].clientY;
  };
  const onPullMove = (e: React.TouchEvent) => {
    if (!atTop.current) return;
    const y = e.touches[0].clientY;
    const delta = y - pullStartY.current;
    if (delta > 0) setPullY(Math.min(delta, PULL_THRESHOLD * 1.5));
  };
  const onPullEnd = () => {
    if (pullY >= PULL_THRESHOLD && !loading) loadTenants();
    else setPullY(0);
  };

  const onSwipeStart = (e: React.TouchEvent, id: number) => {
    swipeStartX.current = e.touches[0].clientX;
    setSwipeDragId(id);
    setSwipeOffset(0);
  };
  const onSwipeMove = (e: React.TouchEvent, id: number) => {
    if (swipeDragId !== id) return;
    const x = e.touches[0].clientX;
    const delta = x - swipeStartX.current;
    setSwipeOffset(Math.max(-SWIPE_REVEAL_PX, Math.min(0, delta)));
  };
  const onSwipeEnd = (id: number) => {
    if (swipeDragId !== id) return;
    setSwipeDragId(null);
    if (swipeOffset < -SWIPE_REVEAL_PX / 2) setOpenSwipeId(id);
    else setOpenSwipeId(null);
    setSwipeOffset(0);
  };

  return (
    <div
      className="pb-24 touch-pan-y"
      onTouchStart={onPullStart}
      onTouchMove={onPullMove}
      onTouchEnd={onPullEnd}
    >
      <AdminToast
        message={toast?.message ?? ""}
        kind={toast?.kind}
        visible={!!toast}
        onClose={() => setToast(null)}
      />

      {pullY > 0 && (
        <div className="flex justify-center py-2 text-sm text-slate-500">
          {pullY >= PULL_THRESHOLD ? "놓으면 새로고침" : "↓ 당겨서 새로고침"}
        </div>
      )}

      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-900">Tenant</h1>
        <p className="text-sm text-slate-600">테넌트를 선택하세요</p>
      </div>

      <div className="mb-4">
        <input
          type="search"
          placeholder="🔍 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ds-input w-full text-base py-3 rounded-xl min-h-[48px]"
          aria-label="테넌트 검색"
        />
      </div>

      {showCreateForm && (
        <div className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-md space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">새 테넌트</h2>
          <div className="space-y-3">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">코드 *</label><input type="text" value={newTenantCode} onChange={(e) => setNewTenantCode(e.target.value)} className="ds-input w-full py-3 rounded-xl min-h-[48px]" placeholder="예: tchul" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">이름 *</label><input type="text" value={newTenantName} onChange={(e) => setNewTenantName(e.target.value)} className="ds-input w-full py-3 rounded-xl min-h-[48px]" placeholder="예: 천안학원" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">도메인 (선택)</label><input type="text" value={newTenantDomain} onChange={(e) => setNewTenantDomain(e.target.value)} className="ds-input w-full py-3 rounded-xl min-h-[48px]" placeholder="예: tchul.com" /></div>
            <label className="flex items-center gap-3 min-h-[48px]">
              <input type="checkbox" checked={createOwnerWithTenant} onChange={(e) => setCreateOwnerWithTenant(e.target.checked)} className="w-5 h-5" />
              <span className="text-sm font-medium text-slate-900">테넌트 생성 시 오너 계정도 생성</span>
            </label>
            {createOwnerWithTenant && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="block text-xs font-medium text-slate-700 mb-1">사용자명 *</label><input type="text" value={newOwnerUsername} onChange={(e) => setNewOwnerUsername(e.target.value)} className="ds-input w-full py-3 min-h-[48px] rounded-xl" /></div>
                <div><label className="block text-xs font-medium text-slate-700 mb-1">비밀번호 *</label><input type="password" value={newOwnerPassword} onChange={(e) => setNewOwnerPassword(e.target.value)} className="ds-input w-full py-3 min-h-[48px] rounded-xl" /></div>
                <div><label className="block text-xs font-medium text-slate-700 mb-1">이름</label><input type="text" value={newOwnerName} onChange={(e) => setNewOwnerName(e.target.value)} className="ds-input w-full py-3 min-h-[48px] rounded-xl" /></div>
                <div><label className="block text-xs font-medium text-slate-700 mb-1">전화번호</label><input type="text" value={newOwnerPhone} onChange={(e) => setNewOwnerPhone(e.target.value)} className="ds-input w-full py-3 min-h-[48px] rounded-xl" /></div>
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleCreateTenant} className="flex-1 ds-button min-h-[48px] rounded-xl" data-intent="primary" data-size="md">생성</button>
            <button type="button" onClick={() => setShowCreateForm(false)} className="flex-1 ds-button min-h-[48px] rounded-xl" data-intent="secondary" data-size="md">취소</button>
          </div>
        </div>
      )}

      {loading && !tenants.length ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((tenant) => {
            const isOpen = openSwipeId === tenant.id;
            const isDragging = swipeDragId === tenant.id;
            const tx = isDragging ? swipeOffset : isOpen ? -SWIPE_REVEAL_PX : 0;
            return (
              <li key={tenant.id} className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                <div className="relative flex items-stretch min-h-[56px]">
                  <div
                    className="flex-1 flex items-center justify-between gap-3 p-4 min-w-0 transition-transform duration-150"
                    style={{ transform: `translateX(${tx}px)` }}
                    onTouchStart={(e) => onSwipeStart(e, tenant.id)}
                    onTouchMove={(e) => onSwipeMove(e, tenant.id)}
                    onTouchEnd={() => onSwipeEnd(tenant.id)}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (openSwipeId === tenant.id) setOpenSwipeId(null);
                        else navigate(`/dev/branding/${tenant.id}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (openSwipeId === tenant.id) setOpenSwipeId(null);
                          else navigate(`/dev/branding/${tenant.id}`);
                        }
                      }}
                      className="absolute inset-0 z-0"
                      aria-label={`${tenant.name} 설정`}
                    />
                    <div className="relative z-10 min-w-0 flex-1 pointer-events-none">
                      <div className="font-semibold text-slate-900 truncate">{tenant.name}</div>
                      <div className="text-sm text-slate-500 truncate">{tenant.primaryDomain || tenant.code}</div>
                    </div>
                    <span className={`relative z-10 shrink-0 text-xs font-medium px-2 py-1 rounded-full ${tenant.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                      {tenant.isActive ? "활성" : "비활성"}
                    </span>
                    <span className="relative z-10 shrink-0 text-slate-400" aria-hidden>›</span>
                  </div>
                  <div className="flex shrink-0 w-20 items-stretch">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(tenant)}
                      disabled={togglingId === tenant.id}
                      className={`w-full min-h-[48px] text-xs font-medium flex items-center justify-center ${
                        tenant.isActive ? "bg-amber-100 text-amber-800 active:bg-amber-200" : "bg-emerald-100 text-emerald-800 active:bg-emerald-200"
                      }`}
                    >
                      {togglingId === tenant.id ? "…" : tenant.isActive ? "비활성화" : "활성화"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !showCreateForm && (
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 font-medium min-h-[48px] active:bg-slate-50"
        >
          + 새 테넌트
        </button>
      )}
    </div>
  );
}
