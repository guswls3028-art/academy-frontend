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
  const [loginSubtitles, setLoginSubtitles] = useState<Record<number, string>>({});
  
  // 테넌트 생성 폼
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTenantCode, setNewTenantCode] = useState("");
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantDomain, setNewTenantDomain] = useState("");
  
  // Owner 등록 폼
  const [ownerForms, setOwnerForms] = useState<Record<number, {
    username: string;
    password: string;
    name: string;
    phone: string;
  }>>({});
  const [showOwnerForms, setShowOwnerForms] = useState<Record<number, boolean>>({});

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
          setLoginSubtitles((prev) =>
            branding.loginSubtitle != null ? { ...prev, [tenant.id]: branding.loginSubtitle! } : prev
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
    const form = ownerForms[tenantId];
    if (!form || !form.username) {
      setMessage("사용자명을 입력해주세요.");
      return;
    }
    
    // 새 사용자 생성 시 비밀번호 필수
    const isNewUser = !form.password;
    if (isNewUser) {
      setMessage("새 사용자 생성 시 비밀번호가 필요합니다.");
      return;
    }
    
    try {
      await registerTenantOwner(tenantId, {
        username: form.username,
        password: form.password,
        name: form.name || undefined,
        phone: form.phone || undefined,
      });
      setMessage(`테넌트 ${tenantId}에 ${form.username}을(를) owner로 등록했습니다.`);
      setOwnerForms((prev) => ({ ...prev, [tenantId]: { username: "", password: "", name: "", phone: "" } }));
      setShowOwnerForms((prev) => ({ ...prev, [tenantId]: false }));
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
    const subtitle = loginSubtitles[tenantId];
    setMessage(null);
    try {
      await patchTenantBranding(tenantId, { 
        loginTitle: title,
        loginSubtitle: subtitle,
      });
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
  }, [loginTitles, loginSubtitles]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">테넌트 목록을 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 mb-2">
            Tenant Management
          </h1>
          <p className="text-slate-600">
            테넌트 관리, 브랜딩 설정, Owner 등록
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-600"
        >
          {showCreateForm ? "취소" : "+ 새 테넌트"}
        </button>
      </div>

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

      {showCreateForm && (
        <div className="mb-6 bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-medium text-slate-800 mb-4">새 테넌트 생성</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                코드 *
              </label>
              <input
                type="text"
                value={newTenantCode}
                onChange={(e) => setNewTenantCode(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                placeholder="예: tchul"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                이름 *
              </label>
              <input
                type="text"
                value={newTenantName}
                onChange={(e) => setNewTenantName(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                placeholder="예: 천안학원"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                도메인 (선택)
              </label>
              <input
                type="text"
                value={newTenantDomain}
                onChange={(e) => setNewTenantDomain(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                placeholder="예: tchul.hakwonplus.com"
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={handleCreateTenant}
              className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-600"
            >
              생성
            </button>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {tenants.map((tenant) => {
          const id = tenant.id;
          const name = tenant.name;
          const fallback = getTenantBranding(id);
          const logoUrl = logoUrls[id] ?? fallback.logoUrl;
          const loginTitle = loginTitles[id] ?? fallback.loginTitle ?? "";
          const loginSubtitle = loginSubtitles[id] ?? fallback.loginSubtitle ?? "";
          const ownerForm = ownerForms[id] || { username: "", password: "", name: "", phone: "" };

          return (
            <section
              key={id}
              className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-medium text-slate-800">
                    {name} ({tenant.code})
                  </h2>
                  <div className="text-sm text-slate-500 mt-1">
                    ID: {id} | 도메인: {tenant.primaryDomain || "없음"} |{" "}
                    {tenant.isActive ? (
                      <span className="text-green-600">활성</span>
                    ) : (
                      <span className="text-red-600">비활성</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Owner 등록 */}
              <div className="mb-6 p-4 bg-slate-50 rounded border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Owner 등록
                  </label>
                  <button
                    onClick={() => setShowOwnerForms((prev) => ({ ...prev, [id]: !prev[id] }))}
                    className="text-xs text-slate-600 hover:text-slate-800"
                  >
                    {showOwnerForms[id] ? "간단 모드" : "상세 모드"}
                  </button>
                </div>
                
                {showOwnerForms[id] ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          사용자명 *
                        </label>
                        <input
                          type="text"
                          value={ownerForm.username}
                          onChange={(e) =>
                            setOwnerForms((prev) => ({
                              ...prev,
                              [id]: { ...ownerForm, username: e.target.value },
                            }))
                          }
                          className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                          placeholder="예: admin97"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          비밀번호 * (새 사용자 생성 시 필수)
                        </label>
                        <input
                          type="password"
                          value={ownerForm.password}
                          onChange={(e) =>
                            setOwnerForms((prev) => ({
                              ...prev,
                              [id]: { ...ownerForm, password: e.target.value },
                            }))
                          }
                          className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                          placeholder="비밀번호 입력"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          이름
                        </label>
                        <input
                          type="text"
                          value={ownerForm.name}
                          onChange={(e) =>
                            setOwnerForms((prev) => ({
                              ...prev,
                              [id]: { ...ownerForm, name: e.target.value },
                            }))
                          }
                          className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                          placeholder="예: 홍길동"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          전화번호
                        </label>
                        <input
                          type="text"
                          value={ownerForm.phone}
                          onChange={(e) =>
                            setOwnerForms((prev) => ({
                              ...prev,
                              [id]: { ...ownerForm, phone: e.target.value },
                            }))
                          }
                          className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                          placeholder="예: 01012345678"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRegisterOwner(id)}
                        className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-600"
                      >
                        등록
                      </button>
                      <button
                        onClick={() => {
                          setOwnerForms((prev) => ({ ...prev, [id]: { username: "", password: "", name: "", phone: "" } }));
                          setShowOwnerForms((prev) => ({ ...prev, [id]: false }));
                        }}
                        className="px-4 py-2 bg-slate-200 text-slate-700 text-sm rounded hover:bg-slate-300"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={ownerForm.username}
                      onChange={(e) =>
                        setOwnerForms((prev) => ({
                          ...prev,
                          [id]: { ...ownerForm, username: e.target.value },
                        }))
                      }
                      className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm"
                      placeholder="사용자명 (기존 사용자)"
                    />
                    <button
                      onClick={() => handleRegisterOwner(id)}
                      className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-600"
                    >
                      등록
                    </button>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-md font-medium text-slate-700 mb-4">브랜딩 설정</h3>
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
                  <div className="flex gap-2 mb-3">
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
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      로그인 서브타이틀
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={loginSubtitle}
                        onChange={(e) =>
                          setLoginSubtitles((prev) => ({
                            ...prev,
                            [id]: e.target.value,
                          }))
                        }
                        className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm"
                        placeholder="로그인 화면 하단 문구"
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
              </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
