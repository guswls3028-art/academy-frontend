// PATH: src/admin_app/pages/TenantBrandingPage.tsx
// Tenant Management: 좌측 리스트 + 우측 탭(Overview, Branding, Domains, Owners).

import { useState, useCallback, useEffect } from "react";
import {
  getTenantBranding as getTenantBrandingApi,
  uploadTenantLogo,
  patchTenantBranding,
} from "@/admin_app/api/branding";
import {
  getTenants,
  getTenantOwners,
  createTenant,
  registerTenantOwner,
  type TenantDto,
} from "@/admin_app/api/tenants";
import TenantListPanel from "@/admin_app/features/tenants/TenantListPanel";
import TenantDetailPanel, { type TabId } from "@/admin_app/features/tenants/TenantDetailPanel";
import AdminOwnerBottomSheet from "@/admin_app/components/AdminOwnerBottomSheet";
import "@/styles/design-system/index.css";
import "@/styles/design-system/ds/input.css";

const defaultOwnerForm = () => ({
  username: "",
  password: "",
  name: "",
  phone: "",
});

export default function TenantBrandingPage() {
  const [tenants, setTenants] = useState<TenantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);
  const [logoUrls, setLogoUrls] = useState<Record<number, string>>({});
  const [loginTitles, setLoginTitles] = useState<Record<number, string>>({});
  const [loginSubtitles, setLoginSubtitles] = useState<Record<number, string>>({});
  const [windowTitles, setWindowTitles] = useState<Record<number, string>>({});
  const [displayNames, setDisplayNames] = useState<Record<number, string>>({});
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTenantCode, setNewTenantCode] = useState("");
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantDomain, setNewTenantDomain] = useState("");
  const [createOwnerWithTenant, setCreateOwnerWithTenant] = useState(false);
  const [newOwnerUsername, setNewOwnerUsername] = useState("");
  const [newOwnerPassword, setNewOwnerPassword] = useState("");
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerPhone, setNewOwnerPhone] = useState("");

  const [ownersByTenantId, setOwnersByTenantId] = useState<Record<number, Awaited<ReturnType<typeof getTenantOwners>>>>({});
  const [ownersLoadingById, setOwnersLoadingById] = useState<Record<number, boolean>>({});
  const [ownerSheetOpen, setOwnerSheetOpen] = useState(false);

  useEffect(() => {
    loadTenants();
  }, []);

  useEffect(() => {
    if (!loading && tenants.length > 0 && selectedTenantId === null)
      setSelectedTenantId(tenants[0].id);
  }, [loading, tenants, selectedTenantId]);

  const loadOwnersForTenant = useCallback(async (tenantId: number) => {
    setOwnersLoadingById((p) => ({ ...p, [tenantId]: true }));
    try {
      const list = await getTenantOwners(tenantId);
      setOwnersByTenantId((p) => ({ ...p, [tenantId]: list }));
    } catch {
      setOwnersByTenantId((p) => ({ ...p, [tenantId]: [] }));
    } finally {
      setOwnersLoadingById((p) => ({ ...p, [tenantId]: false }));
    }
  }, []);

  useEffect(() => {
    if (selectedTenantId != null && activeTab === "owners") {
      loadOwnersForTenant(selectedTenantId);
    }
  }, [selectedTenantId, activeTab, loadOwnersForTenant]);

  useEffect(() => {
    if (!message || messageType !== "success") return;
    const t = setTimeout(() => {
      setMessage(null);
      setMessageType(null);
    }, 5000);
    return () => clearTimeout(t);
  }, [message, messageType]);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const data = await getTenants();
      setTenants(data);
      data.forEach((tenant) => {
        getTenantBrandingApi(tenant.id).then((branding) => {
          if (!branding) return;
          if (branding.logoUrl) setLogoUrls((p) => ({ ...p, [tenant.id]: branding.logoUrl! }));
          if (branding.loginTitle != null) setLoginTitles((p) => ({ ...p, [tenant.id]: branding.loginTitle! }));
          if (branding.loginSubtitle != null) setLoginSubtitles((p) => ({ ...p, [tenant.id]: branding.loginSubtitle! }));
          if (branding.windowTitle !== undefined) setWindowTitles((p) => ({ ...p, [tenant.id]: branding.windowTitle || "" }));
          if (branding.displayName !== undefined) setDisplayNames((p) => ({ ...p, [tenant.id]: branding.displayName || "" }));
        }).catch(() => {});
      });
    } catch (e) {
      setMessage("테넌트 목록을 불러오는데 실패했습니다: " + String(e));
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

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
          setMessage(`테넌트 ${newTenantName} 생성 완료. 오너 계정(${newOwnerUsername})도 함께 생성되었습니다.`);
          setMessageType("success");
        } catch (ownerError: unknown) {
          const err = ownerError as { response?: { data?: { detail?: string } } };
          setMessage(`테넌트는 생성되었지만 오너 계정 생성 실패: ${err.response?.data?.detail || String(ownerError)}`);
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
      setSelectedTenantId(tenant.id);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setMessage("테넌트 생성 실패: " + (err.response?.data?.detail || String(e)));
      setMessageType("error");
    }
  };

  const handleFile = useCallback(async (tenantId: number, file: File) => {
    if (!file.type.startsWith("image/")) {
      setMessage("이미지 파일만 선택해 주세요.");
      setMessageType("error");
      return;
    }
    setUploading(tenantId);
    setMessage(null);
    setMessageType(null);
    try {
      const { logoUrl } = await uploadTenantLogo(tenantId, file);
      setLogoUrls((p) => ({ ...p, [tenantId]: logoUrl }));
      setMessage("로고 업로드 완료.");
      setMessageType("success");
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setMessage(status === 404 || status === 501
        ? "백엔드 tenant-branding upload API가 아직 없습니다."
        : "업로드 실패: " + String(e));
      setMessageType("error");
    } finally {
      setUploading(null);
    }
  }, []);

  const handleSaveTitle = useCallback(async (tenantId: number) => {
    setMessage(null);
    setMessageType(null);
    try {
      await patchTenantBranding(tenantId, {
        loginTitle: loginTitles[tenantId],
        loginSubtitle: loginSubtitles[tenantId],
        windowTitle: windowTitles[tenantId],
        displayName: displayNames[tenantId],
      });
      setMessage("브랜딩 설정 저장됨.");
      setMessageType("success");
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setMessage(status === 404 || status === 501
        ? "백엔드 tenant-branding PATCH API가 아직 없습니다."
        : "저장 실패: " + String(e));
      setMessageType("error");
    }
  }, [loginTitles, loginSubtitles, windowTitles, displayNames]);

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId) ?? null;

  if (loading && tenants.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-slate-600">테넌트 목록을 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 mb-4">
        <h1 className="text-xl font-bold text-slate-900">Tenant Management</h1>
        <p className="text-sm text-slate-600">테넌트 관리, 브랜딩, 도메인, Owner 등록</p>
      </div>

      {message && (
        <div
          role="alert"
          className={`mb-4 p-4 rounded-lg text-sm flex items-start justify-between gap-3 ${
            messageType === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : messageType === "error"
                ? "bg-red-50 text-red-800 border border-red-200"
                : "bg-slate-100 text-slate-800 border border-slate-200"
          }`}
        >
          <span className="flex-1">{message}</span>
          <button
            type="button"
            onClick={() => { setMessage(null); setMessageType(null); }}
            className="shrink-0 p-1 -m-1 rounded text-slate-500 hover:text-slate-700 hover:bg-black/5"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
      )}

      {showCreateForm && (
        <div className="mb-6 bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">새 테넌트 생성</h2>
          <div className="grid gap-4 sm:grid-cols-3 mb-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1">코드 *</label>
              <input type="text" value={newTenantCode} onChange={(e) => setNewTenantCode(e.target.value)} className="ds-input w-full" placeholder="예: tchul" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1">이름 *</label>
              <input type="text" value={newTenantName} onChange={(e) => setNewTenantName(e.target.value)} className="ds-input w-full" placeholder="예: 천안학원" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1">도메인 (선택)</label>
              <input type="text" value={newTenantDomain} onChange={(e) => setNewTenantDomain(e.target.value)} className="ds-input w-full" placeholder="예: tchul.com" />
            </div>
          </div>
          <div className="pt-4 border-t border-slate-200">
            <label className="flex items-center gap-2 mb-3">
              <input type="checkbox" checked={createOwnerWithTenant} onChange={(e) => setCreateOwnerWithTenant(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm font-semibold text-slate-900">테넌트 생성 시 오너 계정도 함께 생성</span>
            </label>
            {createOwnerWithTenant && (
              <div className="ml-6 grid gap-3 sm:grid-cols-2">
                <div><label className="block text-xs font-semibold text-slate-900 mb-1">사용자명 *</label><input type="text" value={newOwnerUsername} onChange={(e) => setNewOwnerUsername(e.target.value)} className="ds-input w-full" placeholder="예: admin" /></div>
                <div><label className="block text-xs font-semibold text-slate-900 mb-1">비밀번호 *</label><input type="password" value={newOwnerPassword} onChange={(e) => setNewOwnerPassword(e.target.value)} className="ds-input w-full" placeholder="비밀번호" /></div>
                <div><label className="block text-xs font-semibold text-slate-900 mb-1">이름</label><input type="text" value={newOwnerName} onChange={(e) => setNewOwnerName(e.target.value)} className="ds-input w-full" placeholder="예: 홍길동" /></div>
                <div><label className="block text-xs font-semibold text-slate-900 mb-1">전화번호</label><input type="text" value={newOwnerPhone} onChange={(e) => setNewOwnerPhone(e.target.value)} className="ds-input w-full" placeholder="예: 01012345678" /></div>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-4">
            <button type="button" onClick={handleCreateTenant} className="ds-button" data-intent="primary" data-size="md">테넌트 생성{createOwnerWithTenant ? " + 오너" : ""}</button>
            <button type="button" onClick={() => { setShowCreateForm(false); setNewTenantCode(""); setNewTenantName(""); setNewTenantDomain(""); setCreateOwnerWithTenant(false); setNewOwnerUsername(""); setNewOwnerPassword(""); setNewOwnerName(""); setNewOwnerPhone(""); }} className="ds-button" data-intent="secondary" data-size="md">취소</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-0 flex-1 min-h-0 rounded-lg border border-slate-200 overflow-hidden bg-white min-h-[480px]">
        <div className="h-[280px] md:h-full md:min-h-0 flex flex-col">
          <TenantListPanel
            tenants={tenants}
            selectedId={selectedTenantId}
            onSelect={(t) => { setSelectedTenantId(t.id); setActiveTab("overview"); }}
            loading={loading}
            onCreateClick={() => setShowCreateForm((v) => !v)}
            showCreateForm={showCreateForm}
          />
        </div>
        <div className="min-h-0 md:min-h-[420px] flex flex-col">
          <TenantDetailPanel
            tenant={selectedTenant}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            branding={{
              logoUrls,
              loginTitles,
              loginSubtitles,
              windowTitles,
              displayNames,
            }}
            uploadingLogoId={uploading}
            ownersList={selectedTenantId != null ? (ownersByTenantId[selectedTenantId] ?? []) : []}
            ownersLoading={selectedTenantId != null ? (ownersLoadingById[selectedTenantId] ?? false) : false}
            onOpenOwnerSheet={() => setOwnerSheetOpen(true)}
            onLogoUpload={handleFile}
            onSaveBranding={handleSaveTitle}
            onDisplayNameChange={(id, v) => setDisplayNames((p) => ({ ...p, [id]: v }))}
            onWindowTitleChange={(id, v) => setWindowTitles((p) => ({ ...p, [id]: v }))}
            onLoginTitleChange={(id, v) => setLoginTitles((p) => ({ ...p, [id]: v }))}
            onLoginSubtitleChange={(id, v) => setLoginSubtitles((p) => ({ ...p, [id]: v }))}
          />
        </div>
      </div>
    </div>
  );
}
