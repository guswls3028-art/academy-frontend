// PATH: src/admin_app/pages/TenantBrandingPage.tsx
// Per-tenant logo and login branding. Upload -> R2 (academy-admin bucket).

import { useState, useCallback, useEffect } from "react";
import { getTenantBranding, getTenantIdFromCode } from "@/shared/tenant/config";
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
import "@/styles/design-system/index.css";
import "@/styles/design-system/ds/input.css";

export default function TenantBrandingPage() {
  const [tenants, setTenants] = useState<TenantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [logoUrls, setLogoUrls] = useState<Record<number, string>>({});
  const [loginTitles, setLoginTitles] = useState<Record<number, string>>({});
  const [loginSubtitles, setLoginSubtitles] = useState<Record<number, string>>({});
  const [windowTitles, setWindowTitles] = useState<Record<number, string>>({});
  const [displayNames, setDisplayNames] = useState<Record<number, string>>({});
  
  // 테넌트 생성 폼
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTenantCode, setNewTenantCode] = useState("");
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantDomain, setNewTenantDomain] = useState("");
  const [createOwnerWithTenant, setCreateOwnerWithTenant] = useState(false);
  const [newOwnerUsername, setNewOwnerUsername] = useState("");
  const [newOwnerPassword, setNewOwnerPassword] = useState("");
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerPhone, setNewOwnerPhone] = useState("");
  
  // Owner 등록 폼
  const [ownerForms, setOwnerForms] = useState<Record<number, {
    username: string;
    password: string;
    name: string;
    phone: string;
  }>>({});
  const [registeringOwnerId, setRegisteringOwnerId] = useState<number | null>(null);
  const [lastOwnerRegistered, setLastOwnerRegistered] = useState<Record<number, { username: string }>>({});
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);

  // 테넌트 목록 로드
  useEffect(() => {
    loadTenants();
  }, []);

  // 성공 메시지 5초 후 자동 제거
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
          if (branding.windowTitle !== undefined) {
            setWindowTitles((prev) => ({ ...prev, [tenant.id]: branding.windowTitle || "" }));
          }
          if (branding.displayName !== undefined) {
            setDisplayNames((prev) => ({ ...prev, [tenant.id]: branding.displayName || "" }));
          }
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
    if (createOwnerWithTenant) {
      if (!newOwnerUsername || !newOwnerPassword) {
        setMessage("오너 계정 생성 시 사용자명과 비밀번호는 필수입니다.");
        setMessageType("error");
        return;
      }
    }
    try {
      const tenant = await createTenant({
        code: newTenantCode,
        name: newTenantName,
        domain: newTenantDomain || undefined,
      });
      
      // 오너 계정도 함께 생성
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
          const error = ownerError as { response?: { data?: { detail?: string } } };
          setMessage(`테넌트는 생성되었지만 오너 계정 생성 실패: ${error.response?.data?.detail || String(ownerError)}`);
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
      const error = e as { response?: { data?: { detail?: string } } };
      setMessage("테넌트 생성 실패: " + (error.response?.data?.detail || String(e)));
      setMessageType("error");
    }
  };

  const handleRegisterOwner = async (tenantId: number) => {
    const form = ownerForms[tenantId];
    if (!form || !form.username) {
      setMessage("사용자명을 입력해주세요.");
      return;
    }
    
    if (!form.password) {
      setMessage("비밀번호를 입력해주세요.");
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
    const windowTitle = windowTitles[tenantId];
    const displayName = displayNames[tenantId];
    setMessage(null);
    try {
      await patchTenantBranding(tenantId, { 
        loginTitle: title,
        loginSubtitle: subtitle,
        windowTitle: windowTitle,
        displayName: displayName,
      });
      setMessage(`Tenant ${tenantId} 브랜딩 설정 저장됨.`);
      // Program 데이터 리로드
      window.location.reload();
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
  }, [loginTitles, loginSubtitles, windowTitles, displayNames]);

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
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            Tenant Management
          </h1>
          <p className="text-slate-700">
            테넌트 관리, 브랜딩 설정, Owner 등록
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="ds-button"
          data-intent="primary"
          data-size="md"
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

      {/* Custom domains — 최소 동작: 등록된 도메인 목록 + Active/SSL 표시 */}
      <div className="mb-6 bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Custom domains</h2>
        <p className="text-sm text-slate-600 mb-4">
          Set up custom domains to point to your site.
        </p>
        {loading ? (
          <p className="text-slate-500 text-sm">로딩 중...</p>
        ) : (
          <ul className="space-y-3">
            {(() => {
              const items = tenants.flatMap((t) => {
                const domains = t.domains?.length ? t.domains : (t.primaryDomain ? [t.primaryDomain] : []);
                return domains.map((host) => (
                  <li
                    key={`${t.id}-${host}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-slate-100 last:border-0"
                  >
                    <span className="font-medium text-slate-900">{host}</span>
                    <span className="text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1 text-green-600">Active</span>
                      <span className="ml-2 inline-flex items-center gap-1 text-slate-500">SSL enabled</span>
                    </span>
                  </li>
                ));
              });
              if (items.length === 0)
                return <li className="text-slate-500 text-sm">등록된 커스텀 도메인이 없습니다.</li>;
              return items;
            })()}
          </ul>
        )}
      </div>

      {showCreateForm && (
        <div className="mb-6 bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">새 테넌트 생성</h2>
          
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  코드 *
                </label>
                <input
                  type="text"
                  value={newTenantCode}
                  onChange={(e) => setNewTenantCode(e.target.value)}
                  className="ds-input"
                  data-required="true"
                  placeholder="예: tchul"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  이름 *
                </label>
                <input
                  type="text"
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  className="ds-input"
                  data-required="true"
                  placeholder="예: 천안학원"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  도메인 (선택)
                </label>
                <input
                  type="text"
                  value={newTenantDomain}
                  onChange={(e) => setNewTenantDomain(e.target.value)}
                  className="ds-input"
                  placeholder="예: tchul.hakwonplus.com"
                />
              </div>
            </div>

            {/* 오너 계정 생성 옵션 */}
            <div className="pt-4 border-t border-slate-200">
              <label className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  checked={createOwnerWithTenant}
                  onChange={(e) => setCreateOwnerWithTenant(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-semibold text-slate-900">
                  테넌트 생성 시 오너 계정도 함께 생성
                </span>
              </label>

              {createOwnerWithTenant && (
                <div className="ml-6 mt-3 space-y-3 bg-slate-50 p-4 rounded border border-slate-200">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-900 mb-1">
                        사용자명 *
                      </label>
                      <input
                        type="text"
                        value={newOwnerUsername}
                        onChange={(e) => setNewOwnerUsername(e.target.value)}
                        className="ds-input"
                        data-required="true"
                        placeholder="예: admin"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-900 mb-1">
                        비밀번호 *
                      </label>
                      <input
                        type="password"
                        value={newOwnerPassword}
                        onChange={(e) => setNewOwnerPassword(e.target.value)}
                        className="ds-input"
                        data-required="true"
                        placeholder="비밀번호 입력"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-900 mb-1">
                        이름
                      </label>
                      <input
                        type="text"
                        value={newOwnerName}
                        onChange={(e) => setNewOwnerName(e.target.value)}
                        className="ds-input"
                        placeholder="예: 홍길동"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-900 mb-1">
                        전화번호
                      </label>
                      <input
                        type="text"
                        value={newOwnerPhone}
                        onChange={(e) => setNewOwnerPhone(e.target.value)}
                        className="ds-input"
                        placeholder="예: 01012345678"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreateTenant}
                className="ds-button"
                data-intent="primary"
                data-size="md"
              >
                테넌트 생성{createOwnerWithTenant ? " + 오너 계정 생성" : ""}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewTenantCode("");
                  setNewTenantName("");
                  setNewTenantDomain("");
                  setCreateOwnerWithTenant(false);
                  setNewOwnerUsername("");
                  setNewOwnerPassword("");
                  setNewOwnerName("");
                  setNewOwnerPhone("");
                }}
                className="ds-button"
                data-intent="secondary"
                data-size="md"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {tenants.map((tenant) => {
          const id = tenant.id;
          const name = tenant.name;
          // 브랜딩은 DB id가 아니라 코드 기준 1~4(tchul=2, limglish=3, ymath=4)로 매핑. 5,6,7은 비움.
          const logicalId = getTenantIdFromCode(tenant.code);
          const fallback = logicalId != null ? getTenantBranding(logicalId) : undefined;
          const logoUrl = logoUrls[id] ?? fallback?.logoUrl;
          const loginTitle = loginTitles[id] ?? fallback?.loginTitle ?? "";
          const loginSubtitle = loginSubtitles[id] ?? fallback?.loginSubtitle ?? "";
          const windowTitle = windowTitles[id] ?? (fallback as { windowTitle?: string } | undefined)?.windowTitle ?? "";
          const displayName = displayNames[id] ?? (fallback as { displayName?: string } | undefined)?.displayName ?? name;
          const ownerForm = ownerForms[id] || { username: "", password: "", name: "", phone: "" };

          return (
            <section
              key={id}
              className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {name} ({tenant.code})
                  </h2>
                  <div className="text-sm text-slate-600 mt-1">
                    ID: {id} | 도메인: {tenant.primaryDomain || "없음"} |{" "}
                    {tenant.isActive ? (
                      <span className="text-green-600">활성</span>
                    ) : (
                      <span className="text-red-600">비활성</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Owner 등록 — 사용자명, 비밀번호, 이름, 전화번호만 입력 */}
              <div className="mb-6 p-4 bg-slate-50 rounded border border-slate-200">
                <h3 className="block text-sm font-semibold text-slate-900 mb-3">Owner 등록</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-900 mb-1">사용자명 *</label>
                    <input
                      type="text"
                      value={ownerForm.username}
                      onChange={(e) =>
                        setOwnerForms((prev) => ({ ...prev, [id]: { ...ownerForm, username: e.target.value } }))
                      }
                      className="ds-input"
                      placeholder="예: admin97"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-900 mb-1">비밀번호 *</label>
                    <input
                      type="password"
                      value={ownerForm.password}
                      onChange={(e) =>
                        setOwnerForms((prev) => ({ ...prev, [id]: { ...ownerForm, password: e.target.value } }))
                      }
                      className="ds-input"
                      placeholder="비밀번호 입력"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-900 mb-1">이름</label>
                    <input
                      type="text"
                      value={ownerForm.name}
                      onChange={(e) =>
                        setOwnerForms((prev) => ({ ...prev, [id]: { ...ownerForm, name: e.target.value } }))
                      }
                      className="ds-input"
                      placeholder="예: 홍길동"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-900 mb-1">전화번호</label>
                    <input
                      type="text"
                      value={ownerForm.phone}
                      onChange={(e) =>
                        setOwnerForms((prev) => ({ ...prev, [id]: { ...ownerForm, phone: e.target.value } }))
                      }
                      className="ds-input"
                      placeholder="예: 01012345678"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    onClick={() => handleRegisterOwner(id)}
                    className="ds-button"
                    data-intent="primary"
                    data-size="md"
                  >
                    Owner 등록
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-md font-semibold text-slate-900 mb-4">브랜딩 설정</h3>
                <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
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

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      표시 이름 (헤더에 표시) *
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) =>
                        setDisplayNames((prev) => ({
                          ...prev,
                          [id]: e.target.value,
                        }))
                      }
                      className="ds-input w-full"
                      data-required="true"
                      placeholder="예: 박철 과학"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      브라우저 타이틀 (창 제목)
                    </label>
                    <input
                      type="text"
                      value={windowTitle}
                      onChange={(e) =>
                        setWindowTitles((prev) => ({
                          ...prev,
                          [id]: e.target.value,
                        }))
                      }
                      className="ds-input w-full"
                      placeholder="예: 박철 과학 (비워두면 표시 이름 사용)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      로그인 타이틀
                    </label>
                    <input
                      type="text"
                      value={loginTitle}
                      onChange={(e) =>
                        setLoginTitles((prev) => ({
                          ...prev,
                          [id]: e.target.value,
                        }))
                      }
                      className="ds-input w-full"
                      placeholder="로그인 화면 상단 문구"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      로그인 서브타이틀
                    </label>
                    <input
                      type="text"
                      value={loginSubtitle}
                      onChange={(e) =>
                        setLoginSubtitles((prev) => ({
                          ...prev,
                          [id]: e.target.value,
                        }))
                      }
                      className="ds-input w-full"
                      placeholder="로그인 화면 하단 문구"
                    />
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleSaveTitle(id)}
                      className="ds-button"
                      data-intent="primary"
                      data-size="md"
                    >
                      모든 설정 저장
                    </button>
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
