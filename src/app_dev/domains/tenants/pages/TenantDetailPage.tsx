import { useState, useCallback, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  useTenantDetail, useTenantOwners, useUpdateTenant, useRegisterOwner, useUpdateOwner, useRemoveOwner,
  useTenantUsage, useTenantActivity, useImpersonate,
  useTenantStorage, useRefreshTenantStorage,
} from "@dev/domains/tenants/hooks/useTenants";
import { useTenantBranding, useUploadLogo, usePatchBranding } from "@dev/domains/tenants/hooks/useBranding";
import { useDevToast } from "@dev/shared/components/DevToast";
import { getTenantBranding as getStaticBranding, getTenantIdFromCode } from "@/shared/tenant/config";
import type { TenantDetailDto, TenantUsageDto, TenantActivityEntry } from "@dev/domains/tenants/api/tenants.api";
import { beginImpersonation, abortImpersonation } from "@dev/shared/components/ImpersonationBanner";
import s from "@dev/layout/DevLayout.module.css";

type TabId = "overview" | "usage" | "activity" | "branding" | "domains" | "owners";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "개요" },
  { id: "usage", label: "사용량" },
  { id: "activity", label: "활동" },
  { id: "branding", label: "브랜딩" },
  { id: "domains", label: "도메인" },
  { id: "owners", label: "소유자" },
];

export default function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const id = tenantId ? parseInt(tenantId, 10) : NaN;
  const [tab, setTab] = useState<TabId>("overview");

  const { data: tenant, isLoading } = useTenantDetail(Number.isNaN(id) ? null : id);

  if (isLoading) {
    return (
      <>
        <header className={s.header}>
          <div className={s.headerLeft}>
            <Link to="/dev/tenants" style={{ color: "inherit", textDecoration: "none" }}>테넌트</Link>
            <span className={s.breadcrumbSep}>/</span>
            <span className={s.breadcrumbCurrent}>불러오는 중...</span>
          </div>
        </header>
        <div className={s.content}>
          <div className={s.skeleton} style={{ width: 200, height: 28, marginBottom: 16 }} />
          <div className={s.skeleton} style={{ height: 400 }} />
        </div>
      </>
    );
  }

  if (!tenant) {
    return (
      <>
        <header className={s.header}>
          <div className={s.headerLeft}>
            <Link to="/dev/tenants" style={{ color: "inherit", textDecoration: "none" }}>테넌트</Link>
            <span className={s.breadcrumbSep}>/</span>
            <span className={s.breadcrumbCurrent}>찾을 수 없음</span>
          </div>
        </header>
        <div className={s.content}>
          <div className={s.empty}>
            <div className={s.emptyText}>테넌트를 찾을 수 없습니다.</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className={s.header}>
        <div className={s.headerLeft}>
          <Link to="/dev/dashboard" style={{ color: "inherit", textDecoration: "none" }}>대시보드</Link>
          <span className={s.breadcrumbSep}>/</span>
          <Link to="/dev/tenants" style={{ color: "inherit", textDecoration: "none" }}>테넌트</Link>
          <span className={s.breadcrumbSep}>/</span>
          <span className={s.breadcrumbCurrent}>{tenant.name}</span>
        </div>
        <div className={s.headerRight} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={`${s.badge} ${tenant.isActive ? s.badgeActive : s.badgeInactive}`}>
            <span className={`${s.badgeDot} ${tenant.isActive ? s.badgeDotActive : s.badgeDotInactive}`} />
            {tenant.isActive ? "활성" : "비활성"}
          </span>
          <AdminJumpButton tenant={tenant} />
        </div>
      </header>

      <div className={s.content}>
        <div className={s.pageHeader}>
          <h1 className={s.pageTitle}>{tenant.name}</h1>
          <p className={s.pageSub}>
            <span className={s.code}>{tenant.code}</span>
            {tenant.primaryDomain && <> · {tenant.primaryDomain}</>}
          </p>
        </div>

        <div className={s.tabs}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`${s.tab} ${tab === t.id ? s.tabActive : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab tenant={tenant} />}
        {tab === "usage" && <UsageTab tenantId={id} />}
        {tab === "activity" && <ActivityTab tenantId={id} />}
        {tab === "branding" && <BrandingTab tenantId={id} tenantCode={tenant.code} />}
        {tab === "domains" && <DomainsTab tenant={tenant} />}
        {tab === "owners" && <OwnersTab tenantId={id} tenantName={tenant.name} />}
      </div>
    </>
  );
}

/* ===== Admin 점프 버튼 ===== */
function AdminJumpButton({ tenant }: { tenant: TenantDetailDto }) {
  const host = tenant.primaryDomain;
  if (!host) return null;
  const url = `https://${host}/admin`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${s.btn} ${s.btnSecondary} ${s.btnSm}`}
      style={{ textDecoration: "none" }}
      title={`${url} 새 탭에서 열기`}
    >
      ↗ /admin 열기
    </a>
  );
}

/* ===== 개요 탭 ===== */
function OverviewTab({ tenant }: { tenant: TenantDetailDto }) {
  const updateTenant = useUpdateTenant();
  const { toast } = useDevToast();

  async function handleToggle() {
    try {
      await updateTenant.mutateAsync({ id: tenant.id, isActive: !tenant.isActive });
      toast(tenant.isActive ? "비활성화됨" : "활성화됨");
    } catch {
      toast("변경 실패", "error");
    }
  }

  const domains: Array<{ host: string; isPrimary: boolean }> = Array.isArray(tenant.domains)
    ? tenant.domains.map((d) =>
        typeof d === "string"
          ? { host: d, isPrimary: d === tenant.primaryDomain }
          : (d as { host: string; isPrimary: boolean }),
      )
    : tenant.primaryDomain
    ? [{ host: tenant.primaryDomain, isPrimary: true }]
    : [];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div className={s.card}>
        <div className={s.cardHeader}>
          <h3 className={s.cardTitle}>테넌트 정보</h3>
        </div>
        <div className={s.cardBody}>
          <div className={s.infoGrid}>
            <div className={s.infoLabel}>ID</div>
            <div className={s.infoValue}>{tenant.id}</div>
            <div className={s.infoLabel}>코드</div>
            <div className={s.infoValue}><span className={s.code}>{tenant.code}</span></div>
            <div className={s.infoLabel}>이름</div>
            <div className={s.infoValue}>{tenant.name}</div>
            <div className={s.infoLabel}>대표 도메인</div>
            <div className={s.infoValue}>{tenant.primaryDomain || "—"}</div>
            <div className={s.infoLabel}>상태</div>
            <div className={s.infoValue}>
              <span className={`${s.badge} ${tenant.isActive ? s.badgeActive : s.badgeInactive}`}>
                <span className={`${s.badgeDot} ${tenant.isActive ? s.badgeDotActive : s.badgeDotInactive}`} />
                {tenant.isActive ? "활성" : "비활성"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className={s.card}>
        <div className={s.cardHeader}>
          <h3 className={s.cardTitle}>설정</h3>
        </div>
        <div className={s.cardBody}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>테넌트 상태</div>
              <div style={{ fontSize: 12, color: "var(--dev-text-muted)", marginTop: 2 }}>
                {tenant.isActive ? "로그인·가입 가능" : "신규 접속 제한"}
              </div>
            </div>
            <button
              type="button"
              className={s.toggle}
              role="switch"
              aria-checked={tenant.isActive}
              disabled={updateTenant.isPending}
              onClick={handleToggle}
            >
              <span className={s.toggleKnob} />
            </button>
          </div>
          {domains.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--dev-text-muted)", marginBottom: 8 }}>도메인</div>
              {domains.map((d) => (
                <div key={d.host} style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--dev-border-light)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span>
                    {d.host}
                    {d.isPrimary && (
                      <span className={`${s.badge} ${s.badgeActive}`} style={{ fontSize: 10, marginLeft: 8 }}>대표</span>
                    )}
                  </span>
                  <span className={`${s.badge} ${s.badgeActive}`} style={{ fontSize: 10 }}>활성 · SSL</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== 브랜딩 탭 ===== */
function BrandingTab({ tenantId, tenantCode }: { tenantId: number; tenantCode: string }) {
  const { data: branding, isLoading } = useTenantBranding(tenantId);
  const uploadLogo = useUploadLogo();
  const patchBranding = usePatchBranding();
  const { toast } = useDevToast();

  const logicalId = getTenantIdFromCode(tenantCode);
  const fallback = logicalId != null ? getStaticBranding(logicalId) : undefined;

  const [displayName, setDisplayName] = useState("");
  const [windowTitle, setWindowTitle] = useState("");
  const [loginTitle, setLoginTitle] = useState("");
  const [loginSubtitle, setLoginSubtitle] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [initial, setInitial] = useState({ displayName: "", windowTitle: "", loginTitle: "", loginSubtitle: "" });

  // branding 로드 직후 1회 초기화 (테넌트가 바뀌면 다시 초기화)
  useEffect(() => {
    if (isLoading) return;
    if (branding === undefined) return;
    const d = branding?.displayName ?? "";
    const w = branding?.windowTitle ?? "";
    const lt = branding?.loginTitle ?? fallback?.loginTitle ?? "";
    const ls = branding?.loginSubtitle ?? fallback?.loginSubtitle ?? "";
    setDisplayName(d);
    setWindowTitle(w);
    setLoginTitle(lt);
    setLoginSubtitle(ls);
    setInitial({ displayName: d, windowTitle: w, loginTitle: lt, loginSubtitle: ls });
    setInitialized(true);
    // tenantId 단위로만 재초기화. branding 객체가 mutation 후 바뀔 땐 onSuccess의 setInitial이 처리함.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, isLoading]);

  const dirty = initialized && (
    displayName !== initial.displayName ||
    windowTitle !== initial.windowTitle ||
    loginTitle !== initial.loginTitle ||
    loginSubtitle !== initial.loginSubtitle
  );

  const handleLogoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith("image/")) { toast("이미지 파일만 선택하세요.", "error"); return; }
    uploadLogo.mutate({ tenantId, file }, {
      onSuccess: () => toast("로고 저장됨"),
      onError: () => toast("업로드 실패", "error"),
    });
    e.target.value = "";
  }, [tenantId, uploadLogo, toast]);

  function handleSave() {
    patchBranding.mutate({ tenantId, displayName, windowTitle, loginTitle, loginSubtitle }, {
      onSuccess: () => {
        setInitial({ displayName, windowTitle, loginTitle, loginSubtitle });
        toast("저장 완료");
      },
      onError: () => toast("저장 실패", "error"),
    });
  }

  function handleDiscard() {
    setDisplayName(initial.displayName);
    setWindowTitle(initial.windowTitle);
    setLoginTitle(initial.loginTitle);
    setLoginSubtitle(initial.loginSubtitle);
  }

  const logoUrl = branding?.logoUrl ?? fallback?.logoUrl ?? null;

  if (isLoading) {
    return <div className={s.skeleton} style={{ height: 300 }} />;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {/* 로고 */}
      <div className={s.card}>
        <div className={s.cardHeader}>
          <h3 className={s.cardTitle}>로고</h3>
        </div>
        <div className={s.cardBody}>
          <label className={s.logoUpload}>
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoChange} />
            {logoUrl ? (
              <>
                <img src={logoUrl} alt="로고" className={s.logoUploadImg} />
                <span className={s.logoUploadText}>클릭하여 변경</span>
              </>
            ) : (
              <span className={s.logoUploadText}>클릭하여 로고 업로드</span>
            )}
            {uploadLogo.isPending && <div className={s.logoUploadOverlay}>업로드 중...</div>}
          </label>
        </div>
      </div>

      {/* 표시 설정 */}
      <div className={s.card}>
        <div className={s.cardHeader}>
          <h3 className={s.cardTitle}>표시 설정</h3>
        </div>
        <div className={s.cardBody} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className={s.inputLabel}>표시 이름</label>
            <input className={s.input} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="헤더에 표시될 이름" />
          </div>
          <div>
            <label className={s.inputLabel}>브라우저 제목</label>
            <input className={s.input} value={windowTitle} onChange={(e) => setWindowTitle(e.target.value)} placeholder="브라우저 탭 제목" />
          </div>
          <div>
            <label className={s.inputLabel}>로그인 제목</label>
            <input className={s.input} value={loginTitle} onChange={(e) => setLoginTitle(e.target.value)} placeholder="로그인 화면 타이틀" />
          </div>
          <div>
            <label className={s.inputLabel}>로그인 부제목</label>
            <input className={s.input} value={loginSubtitle} onChange={(e) => setLoginSubtitle(e.target.value)} placeholder="로그인 화면 서브타이틀" />
          </div>
        </div>
        {dirty && (
          <div className={s.saveBar}>
            <span className={s.saveBarText}>변경 사항이 있습니다</span>
            <div className={s.saveBarActions}>
              <button type="button" className={`${s.btn} ${s.btnSecondary} ${s.btnSm}`} onClick={handleDiscard}>취소</button>
              <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`} onClick={handleSave} disabled={patchBranding.isPending}>
                {patchBranding.isPending ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== 도메인 탭 ===== */
function DomainsTab({ tenant }: { tenant: TenantDetailDto }) {
  const domains: Array<{ host: string; isPrimary: boolean }> = Array.isArray(tenant.domains)
    ? tenant.domains.map((d) =>
        typeof d === "string"
          ? { host: d, isPrimary: d === tenant.primaryDomain }
          : (d as { host: string; isPrimary: boolean }),
      )
    : tenant.primaryDomain
    ? [{ host: tenant.primaryDomain, isPrimary: true }]
    : [];

  return (
    <div className={s.card}>
      <div className={s.cardHeader}>
        <h3 className={s.cardTitle}>도메인</h3>
      </div>
      {domains.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyText}>등록된 도메인이 없습니다.</div>
        </div>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>호스트</th>
              <th>대표</th>
              <th>상태</th>
              <th>SSL</th>
            </tr>
          </thead>
          <tbody>
            {domains.map((d) => (
              <tr key={d.host}>
                <td style={{ fontWeight: 500 }}>{d.host}</td>
                <td>
                  {d.isPrimary && (
                    <span className={`${s.badge} ${s.badgeActive}`} style={{ fontSize: 10 }}>대표</span>
                  )}
                </td>
                <td>
                  <span className={`${s.badge} ${s.badgeActive}`}>
                    <span className={`${s.badgeDot} ${s.badgeDotActive}`} />
                    활성
                  </span>
                </td>
                <td>
                  <span className={`${s.badge} ${s.badgeActive}`}>유효</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ===== 소유자 탭 ===== */
function OwnersTab({ tenantId, tenantName }: { tenantId: number; tenantName: string }) {
  const navigate = useNavigate();
  const { data: owners, isLoading } = useTenantOwners(tenantId);
  const registerOwner = useRegisterOwner();
  const impersonate = useImpersonate();
  const updateOwner = useUpdateOwner();
  const removeOwner = useRemoveOwner();
  const { toast } = useDevToast();

  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  async function handleAdd() {
    if (!newUser.trim() || !newPw) { toast("아이디와 비밀번호를 입력하세요.", "error"); return; }
    try {
      await registerOwner.mutateAsync({
        tenantId,
        username: newUser.trim(),
        password: newPw,
        name: newName.trim() || undefined,
        phone: newPhone.trim() || undefined,
      });
      toast(`${newUser} 등록 완료`);
      setShowAdd(false); setNewUser(""); setNewPw(""); setNewName(""); setNewPhone("");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast(err.response?.data?.detail || "등록 실패", "error");
    }
  }

  async function handleSaveEdit(userId: number) {
    try {
      await updateOwner.mutateAsync({ tenantId, userId, name: editName || undefined, phone: editPhone || undefined });
      toast("수정 완료");
      setEditId(null);
    } catch {
      toast("수정 실패", "error");
    }
  }

  async function handleRemove(userId: number, username: string) {
    if (!confirm(`${username}을(를) ${tenantName}에서 제거할까요?`)) return;
    try {
      await removeOwner.mutateAsync({ tenantId, userId });
      toast("제거 완료");
    } catch {
      toast("제거 실패", "error");
    }
  }

  if (isLoading) {
    return <div className={s.skeleton} style={{ height: 200 }} />;
  }

  return (
    <>
      <div className={s.card} style={{ marginBottom: 16 }}>
        <div className={s.cardHeader}>
          <h3 className={s.cardTitle}>소유자 ({owners?.length ?? 0})</h3>
          <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`} onClick={() => setShowAdd(!showAdd)}>
            + 소유자 추가
          </button>
        </div>

        {showAdd && (
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--dev-border-light)", background: "var(--dev-bg)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label className={s.inputLabel}>아이디 *</label>
                <input className={s.input} value={newUser} onChange={(e) => setNewUser(e.target.value)} placeholder="admin97" />
              </div>
              <div>
                <label className={s.inputLabel}>비밀번호 *</label>
                <input className={s.input} type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
              </div>
              <div>
                <label className={s.inputLabel}>이름</label>
                <input className={s.input} value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div>
                <label className={s.inputLabel}>전화번호</label>
                <input className={s.input} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className={`${s.btn} ${s.btnSecondary} ${s.btnSm}`} onClick={() => setShowAdd(false)}>취소</button>
              <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`} onClick={handleAdd} disabled={registerOwner.isPending}>
                {registerOwner.isPending ? "생성 중..." : "생성"}
              </button>
            </div>
          </div>
        )}

        {!owners?.length ? (
          <div className={s.empty}>
            <div className={s.emptyText}>등록된 소유자가 없습니다.</div>
          </div>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>아이디</th>
                <th>이름</th>
                <th>전화번호</th>
                <th>역할</th>
                <th style={{ width: 120 }}>동작</th>
              </tr>
            </thead>
            <tbody>
              {owners.map((o) => (
                <tr key={o.userId}>
                  {editId === o.userId ? (
                    <>
                      <td style={{ fontWeight: 600 }}>{o.username}</td>
                      <td><input className={s.input} value={editName} onChange={(e) => setEditName(e.target.value)} style={{ height: 32 }} /></td>
                      <td><input className={s.input} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} style={{ height: 32 }} /></td>
                      <td><span className={`${s.badge} ${s.badgeActive}`}>소유자</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`} onClick={() => handleSaveEdit(o.userId)}>저장</button>
                          <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`} onClick={() => setEditId(null)}>취소</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ fontWeight: 600 }}>{o.username}</td>
                      <td>{o.name || "—"}</td>
                      <td style={{ color: "var(--dev-text-secondary)" }}>{o.phone || "—"}</td>
                      <td><span className={`${s.badge} ${s.badgeActive}`}>소유자</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            type="button"
                            className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`}
                            disabled={impersonate.isPending}
                            onClick={async () => {
                              const ok = window.confirm(
                                `[임퍼소네이션]\n${tenantName}의 ${o.username}으로 로그인합니다.\n` +
                                `현재 dev 토큰은 보존되며, 상단 배너에서 언제든 복귀할 수 있습니다.`,
                              );
                              if (!ok) return;
                              try {
                                beginImpersonation(`${tenantName} / ${o.username}`);
                                const r = await impersonate.mutateAsync({ tenantId, userId: o.userId });
                                localStorage.setItem("access", r.access);
                                localStorage.setItem("refresh", r.refresh);
                                navigate("/admin", { replace: true });
                                window.location.reload();
                              } catch (e: unknown) {
                                abortImpersonation();
                                const err = e as { response?: { data?: { detail?: string } } };
                                window.alert("임퍼소네이션 실패: " + (err.response?.data?.detail || String(e)));
                              }
                            }}
                            title="이 사용자로 로그인 (감사 로그 기록)"
                          >
                            로그인
                          </button>
                          <button
                            type="button"
                            className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                            onClick={() => { setEditId(o.userId); setEditName(o.name || ""); setEditPhone(o.phone ?? ""); }}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className={`${s.btn} ${s.btnDanger} ${s.btnSm}`}
                            onClick={() => handleRemove(o.userId, o.username)}
                            disabled={removeOwner.isPending}
                          >
                            제거
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ padding: "12px 16px", background: "var(--dev-primary-subtle)", borderRadius: "var(--dev-radius)", fontSize: 12, color: "var(--dev-primary)" }}>
        이 계정은 <strong>{tenantName}</strong> 전용입니다. 다른 테넌트에서는 로그인할 수 없습니다.
      </div>
    </>
  );
}

/* ===== 사용량 탭 ===== */
function UsageTab({ tenantId }: { tenantId: number }) {
  const { data, isLoading } = useTenantUsage(tenantId);
  if (isLoading) return <div className={s.skeleton} style={{ height: 300 }} />;
  if (!data) return <div className={s.empty}><div className={s.emptyText}>사용량 데이터 없음</div></div>;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
        <UsageStat label="학생" value={data.users.students} />
        <UsageStat label="교사" value={data.users.teachers} />
        <UsageStat label="학부모" value={data.users.parents} />
        <UsageStat label="영상 (활성)" value={data.videos.active} sub={`전체 ${data.videos.total}`} />
        <UsageStat label="영상 처리중" value={data.videos.processing} accent={data.videos.processing > 0 ? "var(--dev-warning)" : undefined} />
        <UsageStat label="영상 실패" value={data.videos.failed} accent={data.videos.failed > 0 ? "var(--dev-danger)" : undefined} />
        <UsageStat label="메시지 30일" value={data.messaging.sent_30d} sub={`실패 ${data.messaging.failed_30d}`} />
      </div>

      <StorageCard tenantId={tenantId} />


      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className={s.card}>
          <div className={s.cardHeader}>
            <h3 className={s.cardTitle}>결제</h3>
          </div>
          <div className={s.cardBody}>
            {data.billing ? (
              <div className={s.infoGrid}>
                <div className={s.infoLabel}>플랜</div>
                <div className={s.infoValue}>{data.billing.plan_display}</div>
                <div className={s.infoLabel}>월 결제액</div>
                <div className={s.infoValue}>{data.billing.monthly_price.toLocaleString("ko-KR")}원</div>
                <div className={s.infoLabel}>상태</div>
                <div className={s.infoValue}>{data.billing.subscription_status_display}</div>
                <div className={s.infoLabel}>만료일</div>
                <div className={s.infoValue}>{data.billing.subscription_expires_at ?? "—"}</div>
                <div className={s.infoLabel}>다음 결제</div>
                <div className={s.infoValue}>{data.billing.next_billing_at ?? "—"}</div>
                <div className={s.infoLabel}>잔여 일수</div>
                <div className={s.infoValue}>{data.billing.days_remaining ?? "—"}</div>
                {data.billing.cancel_at_period_end && (
                  <>
                    <div className={s.infoLabel}>해지 예약</div>
                    <div className={s.infoValue}><span className={`${s.badge}`} style={{ background: "var(--dev-warning-subtle)", color: "var(--dev-warning)" }}>예약됨</span></div>
                  </>
                )}
              </div>
            ) : (
              <div style={{ color: "var(--dev-text-muted)" }}>결제 정보 없음 (Program 미존재)</div>
            )}
          </div>
        </div>

        <div className={s.card}>
          <div className={s.cardHeader}>
            <h3 className={s.cardTitle}>사용자</h3>
          </div>
          <div className={s.cardBody}>
            <div className={s.infoGrid}>
              <div className={s.infoLabel}>최근 로그인</div>
              <div className={s.infoValue}>
                {data.users.last_login_at ? new Date(data.users.last_login_at).toLocaleString("ko-KR") : "기록 없음"}
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--dev-text-muted)", marginBottom: 8 }}>역할별 멤버십</div>
              {Object.entries(data.users.memberships_by_role).length === 0 ? (
                <div style={{ color: "var(--dev-text-muted)", fontSize: 12 }}>없음</div>
              ) : (
                Object.entries(data.users.memberships_by_role).map(([role, n]) => (
                  <div key={role} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                    <span className={s.code}>{role}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{n}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function UsageStat({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent?: string }) {
  return (
    <div className={s.stat}>
      <div className={s.statLabel}>{label}</div>
      <div className={s.statValue} style={{ fontVariantNumeric: "tabular-nums", ...(accent ? { color: accent } : {}) }}>
        {value.toLocaleString("ko-KR")}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--dev-text-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ===== R2 Storage 카드 (지연 로딩) ===== */
function StorageCard({ tenantId }: { tenantId: number }) {
  const { data, isLoading, error } = useTenantStorage(tenantId);
  const refresh = useRefreshTenantStorage();
  const { toast } = useDevToast();

  return (
    <div className={s.card} style={{ marginBottom: 16 }}>
      <div className={s.cardHeader}>
        <div>
          <h3 className={s.cardTitle}>R2 영상 스토리지</h3>
          <div style={{ fontSize: 11, color: "var(--dev-text-muted)", marginTop: 2 }}>
            {data ? (
              <>
                <span className={s.code}>{data.prefix}</span>
                {" · "}
                {data.cached ? "캐시됨" : "방금 계산"} ·{" "}
                {data.calculated_at ? new Date(data.calculated_at).toLocaleString("ko-KR") : "—"}
              </>
            ) : (
              "tenants/<id>/video/ 아래 모든 객체 (raw + HLS + tmp)"
            )}
          </div>
        </div>
        <button
          type="button"
          className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
          disabled={refresh.isPending}
          onClick={async () => {
            try {
              await refresh.mutateAsync(tenantId);
              toast("스토리지 사용량 재계산 완료");
            } catch {
              toast("재계산 실패", "error");
            }
          }}
        >
          {refresh.isPending ? "계산 중…" : "재계산"}
        </button>
      </div>
      <div className={s.cardBody}>
        {isLoading ? (
          <div className={s.skeleton} style={{ height: 60 }} />
        ) : error ? (
          <div style={{ color: "var(--dev-danger)", fontSize: 13 }}>R2 조회 실패. 자격증명/버킷 설정 확인 필요.</div>
        ) : data ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <UsageStat
              label="총 사용량"
              value={Number((data.bytes / (1024 ** 3)).toFixed(2))}
              sub={formatBytes(data.bytes) + " (정확)"}
            />
            <UsageStat label="객체 수" value={data.objects} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n < 1024 ** 4) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  return `${(n / 1024 ** 4).toFixed(2)} TB`;
}

/* ===== 활동 탭 ===== */
function ActivityTab({ tenantId }: { tenantId: number }) {
  const { data, isLoading } = useTenantActivity(tenantId);
  if (isLoading) return <div className={s.skeleton} style={{ height: 300 }} />;

  const items: TenantActivityEntry[] = data?.results ?? [];
  return (
    <div className={s.card}>
      <div className={s.cardHeader}>
        <h3 className={s.cardTitle}>감사 로그</h3>
        <span style={{ fontSize: 13, color: "var(--dev-text-muted)" }}>최근 {items.length}건</span>
      </div>
      {items.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyText}>해당 테넌트 관련 활동 없음</div>
        </div>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th style={{ width: 140 }}>시각</th>
              <th style={{ width: 100 }}>실행자</th>
              <th style={{ width: 140 }}>작업</th>
              <th>요약</th>
              <th style={{ width: 60 }}>결과</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={{ fontSize: 12, color: "var(--dev-text-muted)" }}>
                  {item.created_at ? new Date(item.created_at).toLocaleString("ko-KR") : "—"}
                </td>
                <td style={{ fontSize: 12 }}>{item.actor}</td>
                <td><span className={s.code}>{item.action}</span></td>
                <td style={{ fontSize: 13 }}>
                  {item.summary || "—"}
                  {item.error && (
                    <div style={{ fontSize: 11, color: "var(--dev-danger)", marginTop: 2 }}>{item.error}</div>
                  )}
                </td>
                <td>
                  <span
                    style={{
                      display: "inline-block", padding: "2px 6px", borderRadius: 4,
                      fontSize: 10, fontWeight: 700,
                      background: item.result === "failed" ? "var(--dev-danger-subtle)" : "var(--dev-success-subtle)",
                      color: item.result === "failed" ? "var(--dev-danger)" : "var(--dev-success)",
                    }}
                  >
                    {item.result === "failed" ? "FAIL" : "OK"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
