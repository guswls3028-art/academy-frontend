// PATH: src/admin_app/pages/TenantListPage.tsx
// STEP 1: Tenant 리스트 — 카드형, 48px 터치, 검색, + 새 테넌트

import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { getTenants, createTenant, registerTenantOwner, type TenantDto } from "@/admin_app/api/tenants";
import "@/styles/design-system/index.css";
import "@/styles/design-system/ds/input.css";

const defaultOwnerForm = () => ({ username: "", password: "", name: "", phone: "" });

export default function TenantListPage() {
  const [tenants, setTenants] = useState<TenantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);
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

  const loadTenants = async () => {
    try {
      setLoading(true);
      const data = await getTenants();
      setTenants(data);
    } catch (e) {
      setMessage("테넌트 목록을 불러오는데 실패했습니다: " + String(e));
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

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
      setMessage("코드와 이름을 입력해주세요.");
      setMessageType("error");
      return;
    }
    if (createOwnerWithTenant && (!newOwnerUsername || !newOwnerPassword)) {
      setMessage("오너 계정 생성 시 사용자명과 비밀번호는 필수입니다.");
      setMessageType("error");
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
          setMessage(`테넌트 ${newTenantName} 생성 완료. 오너(${newOwnerUsername}) 등록됨.`);
          setMessageType("success");
        } catch {
          setMessage("테넌트는 생성되었지만 오너 계정 생성에 실패했습니다.");
          setMessageType("error");
        }
      } else {
        setMessage(`테넌트 ${newTenantName} 생성 완료.`);
        setMessageType("success");
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
      setMessage("테넌트 생성 실패: " + (err.response?.data?.detail || String(e)));
      setMessageType("error");
    }
  };

  return (
    <div className="pb-24">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-900">Tenant</h1>
        <p className="text-sm text-slate-600">테넌트를 선택하세요</p>
      </div>

      {message && (
        <div
          role="alert"
          className={`mb-4 p-4 rounded-xl text-sm flex items-start justify-between gap-3 ${
            messageType === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <span className="flex-1">{message}</span>
          <button type="button" onClick={() => { setMessage(null); setMessageType(null); }} className="shrink-0 p-2 -m-2 rounded-lg" aria-label="닫기">✕</button>
        </div>
      )}

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

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((tenant) => (
            <li key={tenant.id}>
              <Link
                to={`/dev/branding/${tenant.id}`}
                className="flex items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm min-h-[56px] active:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 truncate">{tenant.name}</div>
                  <div className="text-sm text-slate-500 truncate">{tenant.primaryDomain || tenant.code}</div>
                </div>
                <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${tenant.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                  {tenant.isActive ? "활성" : "비활성"}
                </span>
                <span className="shrink-0 text-slate-400" aria-hidden>›</span>
              </Link>
            </li>
          ))}
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
