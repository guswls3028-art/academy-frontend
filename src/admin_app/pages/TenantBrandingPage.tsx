// PATH: src/admin_app/pages/TenantBrandingPage.tsx
// Per-tenant logo and login branding. Upload -> R2 (academy-admin bucket).

import { useState, useCallback, useEffect } from "react";
import { getTenantBranding } from "@/shared/tenant/config";
import type { TenantId } from "@/shared/tenant/config";
import {
  getTenantBranding as getTenantBrandingApi,
  uploadTenantLogo,
  patchTenantBranding,
} from "@/admin_app/api/branding";
import {
  getTenants,
  createTenant,
  registerTenantOwner,
  type TenantDto,
} from "@/admin_app/api/tenants";

export default function TenantBrandingPage() {
  const [tenants, setTenants] = useState<TenantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [logoUrls, setLogoUrls] = useState<Record<number, string>>({});
  const [loginTitles, setLoginTitles] = useState<Record<number, string>>({});
  
  // 테넌트 생성 폼
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTenantCode, setNewTenantCode] = useState("");
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantDomain, setNewTenantDomain] = useState("");
  
  // Owner 등록 폼
  const [ownerForms, setOwnerForms] = useState<Record<number, string>>({});

  // 테넌트 목록 로드
  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const data = await getTenants();
      setTenants(data);
      
      // 각 테넌트의 브랜딩 정보 로드
      data.forEach((tenant) => {
        getTenantBrandingApi(tenant.id).then((branding) => {
          if (!branding) return;
          setLogoUrls((prev) => (branding.logoUrl ? { ...prev, [tenant.id]: branding.logoUrl! } : prev));
          setLoginTitles((prev) =>
            branding.loginTitle != null ? { ...prev, [tenant.id]: branding.loginTitle! } : prev
          );
        }).catch(() => {});
      });
    } catch (e) {
      setMessage("테넌트 목록을 불러오는데 실패했습니다: " + String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async () => {
    if (!newTenantCode || !newTenantName) {
      setMessage("코드와 이름을 입력해주세요.");
      return;
    }
    try {
      await createTenant({
        code: newTenantCode,
        name: newTenantName,
        domain: newTenantDomain || undefined,
      });
      setMessage(`테넌트 ${newTenantName} 생성 완료.`);
      setShowCreateForm(false);
      setNewTenantCode("");
      setNewTenantName("");
      setNewTenantDomain("");
      loadTenants();
    } catch (e: unknown) {
      const error = e as { response?: { data?: { detail?: string } } };
      setMessage("테넌트 생성 실패: " + (error.response?.data?.detail || String(e)));
    }
  };

  const handleRegisterOwner = async (tenantId: number) => {
    const username = ownerForms[tenantId];
    if (!username) {
      setMessage("사용자명을 입력해주세요.");
      return;
    }
    try {
      await registerTenantOwner(tenantId, username);
      setMessage(`테넌트 ${tenantId}에 ${username}을(를) owner로 등록했습니다.`);
      setOwnerForms((prev) => ({ ...prev, [tenantId]: "" }));
    } catch (e: unknown) {
      const error = e as { response?: { data?: { detail?: string } } };
      setMessage("Owner 등록 실패: " + (error.response?.data?.detail || String(e)));
    }
  };

  const handleFile = useCallback(
    async (tenantId: number, file: File | null) => {
      if (!file || !file.type.startsWith("image/")) {
        setMessage("이미지 파일만 선택해 주세요.");
        return;
      }
      setUploading(tenantId);
      setMessage(null);
      try {
        const { logoUrl } = await uploadTenantLogo(tenantId, file);
        setLogoUrls((prev) => ({ ...prev, [tenantId]: logoUrl }));
        setMessage(`Tenant ${tenantId} 로고 업로드 완료. R2(academy-admin)에 저장됨.`);
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } })?.response?.status;
        if (status === 404 || status === 501) {
          setMessage(
            "백엔드에 tenant-branding upload API가 아직 없습니다. R2 업로드 API 추가 후 연동 가능."
          );
        } else {
          setMessage("업로드 실패: " + String(e));
        }
      } finally {
        setUploading(null);
      }
    },
    []
  );

  const handleSaveTitle = useCallback(async (tenantId: number) => {
    const title = loginTitles[tenantId];
    if (title == null) return;
    setMessage(null);
    try {
      await patchTenantBranding(tenantId, { loginTitle: title });
      setMessage(`Tenant ${tenantId} 로그인 타이틀 저장됨.`);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 501) {
        setMessage(
          "백엔드 tenant-branding PATCH API가 아직 없습니다. 추가 후 연동 가능."
        );
      } else {
        setMessage("저장 실패: " + String(e));
      }
    }
  }, [loginTitles]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-2">
        Tenant branding
      </h1>
      <p className="text-slate-600 mb-6">
        테넌트별 로고·로그인 타이틀. 로고는 R2(academy-admin)에 저장됩니다.
      </p>

      {message && (
        <div
          className={`mb-4 p-3 rounded text-sm ${
            message.includes("실패") || message.includes("아직 없습니다")
              ? "bg-amber-100 text-amber-800"
              : "bg-blue-50 text-blue-800"
          }`}
        >
          {message}
        </div>
      )}

      <div className="space-y-8">
        {TENANTS.map(({ id, name }) => {
          const fallback = getTenantBranding(id);
          const logoUrl = logoUrls[id] ?? fallback.logoUrl;
          const loginTitle = loginTitles[id] ?? fallback.loginTitle;

          return (
            <section
              key={id}
              className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm"
            >
              <h2 className="text-lg font-medium text-slate-800 mb-4">
                Tenant {id} — {name}
              </h2>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    로고
                  </label>
                  <div className="flex items-center gap-4">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={`${name} logo`}
                        className="h-16 w-auto object-contain border border-slate-200 rounded"
                      />
                    ) : (
                      <div className="h-16 w-24 border border-dashed border-slate-300 rounded flex items-center justify-center text-slate-400 text-xs">
                        No logo
                      </div>
                    )}
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id={`logo-${id}`}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFile(id, f);
                          e.target.value = "";
                        }}
                      />
                      <label
                        htmlFor={`logo-${id}`}
                        className="inline-block px-3 py-2 bg-slate-700 text-white text-sm rounded cursor-pointer hover:bg-slate-600 disabled:opacity-50"
                      >
                        {uploading === id ? "Uploading…" : "Upload logo"}
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    로그인 타이틀
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={loginTitle}
                      onChange={(e) =>
                        setLoginTitles((prev) => ({
                          ...prev,
                          [id]: e.target.value,
                        }))
                      }
                      className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm"
                      placeholder="로그인 화면 상단 문구"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveTitle(id)}
                      className="px-3 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-600"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
