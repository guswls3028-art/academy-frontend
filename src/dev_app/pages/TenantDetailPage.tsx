import { useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { useTenantList, useTenantOwners, useUpdateTenant, useRegisterOwner, useUpdateOwner, useRemoveOwner } from "@/dev_app/hooks/useTenants";
import { useTenantBranding, useUploadLogo, usePatchBranding } from "@/dev_app/hooks/useBranding";
import { useDevToast } from "@/dev_app/components/DevToast";
import { getTenantBranding as getStaticBranding, getTenantIdFromCode } from "@/shared/tenant/config";
import s from "@/dev_app/layout/DevLayout.module.css";

type TabId = "overview" | "branding" | "domains" | "owners";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "branding", label: "Branding" },
  { id: "domains", label: "Domains" },
  { id: "owners", label: "Owners" },
];

export default function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const id = tenantId ? parseInt(tenantId, 10) : NaN;
  const [tab, setTab] = useState<TabId>("overview");

  const { data: tenants, isLoading } = useTenantList();
  const tenant = tenants?.find((t) => t.id === id) ?? null;

  if (isLoading) {
    return (
      <>
        <header className={s.header}>
          <div className={s.headerLeft}>
            <Link to="/dev/tenants" style={{ color: "inherit", textDecoration: "none" }}>Tenants</Link>
            <span className={s.breadcrumbSep}>/</span>
            <span className={s.breadcrumbCurrent}>Loading...</span>
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
            <Link to="/dev/tenants" style={{ color: "inherit", textDecoration: "none" }}>Tenants</Link>
            <span className={s.breadcrumbSep}>/</span>
            <span className={s.breadcrumbCurrent}>Not Found</span>
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
          <Link to="/dev/dashboard" style={{ color: "inherit", textDecoration: "none" }}>Dashboard</Link>
          <span className={s.breadcrumbSep}>/</span>
          <Link to="/dev/tenants" style={{ color: "inherit", textDecoration: "none" }}>Tenants</Link>
          <span className={s.breadcrumbSep}>/</span>
          <span className={s.breadcrumbCurrent}>{tenant.name}</span>
        </div>
        <div className={s.headerRight}>
          <span className={`${s.badge} ${tenant.isActive ? s.badgeActive : s.badgeInactive}`}>
            <span className={`${s.badgeDot} ${tenant.isActive ? s.badgeDotActive : s.badgeDotInactive}`} />
            {tenant.isActive ? "Active" : "Inactive"}
          </span>
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
        {tab === "branding" && <BrandingTab tenantId={id} tenantCode={tenant.code} />}
        {tab === "domains" && <DomainsTab tenant={tenant} />}
        {tab === "owners" && <OwnersTab tenantId={id} tenantName={tenant.name} />}
      </div>
    </>
  );
}

/* ===== Overview Tab ===== */
function OverviewTab({ tenant }: { tenant: { id: number; code: string; name: string; isActive: boolean; primaryDomain: string | null; domains: string[] } }) {
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

  const domains = tenant.domains?.length ? tenant.domains : tenant.primaryDomain ? [tenant.primaryDomain] : [];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div className={s.card}>
        <div className={s.cardHeader}>
          <h3 className={s.cardTitle}>Tenant Info</h3>
        </div>
        <div className={s.cardBody}>
          <div className={s.infoGrid}>
            <div className={s.infoLabel}>ID</div>
            <div className={s.infoValue}>{tenant.id}</div>
            <div className={s.infoLabel}>Code</div>
            <div className={s.infoValue}><span className={s.code}>{tenant.code}</span></div>
            <div className={s.infoLabel}>Name</div>
            <div className={s.infoValue}>{tenant.name}</div>
            <div className={s.infoLabel}>Primary Domain</div>
            <div className={s.infoValue}>{tenant.primaryDomain || "—"}</div>
            <div className={s.infoLabel}>Status</div>
            <div className={s.infoValue}>
              <span className={`${s.badge} ${tenant.isActive ? s.badgeActive : s.badgeInactive}`}>
                <span className={`${s.badgeDot} ${tenant.isActive ? s.badgeDotActive : s.badgeDotInactive}`} />
                {tenant.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className={s.card}>
        <div className={s.cardHeader}>
          <h3 className={s.cardTitle}>Settings</h3>
        </div>
        <div className={s.cardBody}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Tenant Status</div>
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
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--dev-text-muted)", marginBottom: 8 }}>DOMAINS</div>
              {domains.map((d) => (
                <div key={d} style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--dev-border-light)", display: "flex", justifyContent: "space-between" }}>
                  <span>{d}</span>
                  <span className={`${s.badge} ${s.badgeActive}`} style={{ fontSize: 10 }}>Active · SSL</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== Branding Tab ===== */
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

  if (!initialized && !isLoading && branding !== undefined) {
    const d = branding?.displayName ?? fallback?.displayName ?? "";
    const w = branding?.windowTitle ?? "";
    const lt = branding?.loginTitle ?? fallback?.loginTitle ?? "";
    const ls = branding?.loginSubtitle ?? fallback?.loginSubtitle ?? "";
    setDisplayName(d); setWindowTitle(w); setLoginTitle(lt); setLoginSubtitle(ls);
    setInitial({ displayName: d, windowTitle: w, loginTitle: lt, loginSubtitle: ls });
    setInitialized(true);
  }

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
      {/* Logo */}
      <div className={s.card}>
        <div className={s.cardHeader}>
          <h3 className={s.cardTitle}>Logo</h3>
        </div>
        <div className={s.cardBody}>
          <label className={s.logoUpload}>
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoChange} />
            {logoUrl ? (
              <>
                <img src={logoUrl} alt="Logo" className={s.logoUploadImg} />
                <span className={s.logoUploadText}>클릭하여 변경</span>
              </>
            ) : (
              <span className={s.logoUploadText}>클릭하여 로고 업로드</span>
            )}
            {uploadLogo.isPending && <div className={s.logoUploadOverlay}>업로드 중...</div>}
          </label>
        </div>
      </div>

      {/* Text Fields */}
      <div className={s.card}>
        <div className={s.cardHeader}>
          <h3 className={s.cardTitle}>Display Settings</h3>
        </div>
        <div className={s.cardBody} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className={s.inputLabel}>Display Name</label>
            <input className={s.input} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="헤더에 표시될 이름" />
          </div>
          <div>
            <label className={s.inputLabel}>Window Title</label>
            <input className={s.input} value={windowTitle} onChange={(e) => setWindowTitle(e.target.value)} placeholder="브라우저 탭 제목" />
          </div>
          <div>
            <label className={s.inputLabel}>Login Title</label>
            <input className={s.input} value={loginTitle} onChange={(e) => setLoginTitle(e.target.value)} placeholder="로그인 화면 타이틀" />
          </div>
          <div>
            <label className={s.inputLabel}>Login Subtitle</label>
            <input className={s.input} value={loginSubtitle} onChange={(e) => setLoginSubtitle(e.target.value)} placeholder="로그인 화면 서브타이틀" />
          </div>
        </div>
        {dirty && (
          <div className={s.saveBar}>
            <span className={s.saveBarText}>변경 사항이 있습니다</span>
            <div className={s.saveBarActions}>
              <button type="button" className={`${s.btn} ${s.btnSecondary} ${s.btnSm}`} onClick={handleDiscard}>Discard</button>
              <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`} onClick={handleSave} disabled={patchBranding.isPending}>
                {patchBranding.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Domains Tab ===== */
function DomainsTab({ tenant }: { tenant: { primaryDomain: string | null; domains: string[] } }) {
  const domains = tenant.domains?.length ? tenant.domains : tenant.primaryDomain ? [tenant.primaryDomain] : [];

  return (
    <div className={s.card}>
      <div className={s.cardHeader}>
        <h3 className={s.cardTitle}>Domains</h3>
      </div>
      {domains.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyText}>등록된 도메인이 없습니다.</div>
        </div>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>Host</th>
              <th>Status</th>
              <th>SSL</th>
            </tr>
          </thead>
          <tbody>
            {domains.map((d) => (
              <tr key={d}>
                <td style={{ fontWeight: 500 }}>{d}</td>
                <td>
                  <span className={`${s.badge} ${s.badgeActive}`}>
                    <span className={`${s.badgeDot} ${s.badgeDotActive}`} />
                    Active
                  </span>
                </td>
                <td>
                  <span className={`${s.badge} ${s.badgeActive}`}>Valid</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ===== Owners Tab ===== */
function OwnersTab({ tenantId, tenantName }: { tenantId: number; tenantName: string }) {
  const { data: owners, isLoading } = useTenantOwners(tenantId);
  const registerOwner = useRegisterOwner();
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
    if (!newUser.trim() || !newPw) { toast("ID와 PW를 입력하세요.", "error"); return; }
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
          <h3 className={s.cardTitle}>Owners ({owners?.length ?? 0})</h3>
          <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`} onClick={() => setShowAdd(!showAdd)}>
            + Add Owner
          </button>
        </div>

        {showAdd && (
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--dev-border-light)", background: "var(--dev-bg)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label className={s.inputLabel}>Username *</label>
                <input className={s.input} value={newUser} onChange={(e) => setNewUser(e.target.value)} placeholder="admin97" />
              </div>
              <div>
                <label className={s.inputLabel}>Password *</label>
                <input className={s.input} type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
              </div>
              <div>
                <label className={s.inputLabel}>Name</label>
                <input className={s.input} value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div>
                <label className={s.inputLabel}>Phone</label>
                <input className={s.input} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className={`${s.btn} ${s.btnSecondary} ${s.btnSm}`} onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`} onClick={handleAdd} disabled={registerOwner.isPending}>
                {registerOwner.isPending ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        )}

        {!owners?.length ? (
          <div className={s.empty}>
            <div className={s.emptyText}>등록된 Owner가 없습니다.</div>
          </div>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>Username</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Role</th>
                <th style={{ width: 120 }}>Actions</th>
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
                      <td><span className={`${s.badge} ${s.badgeActive}`}>OWNER</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`} onClick={() => handleSaveEdit(o.userId)}>Save</button>
                          <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`} onClick={() => setEditId(null)}>Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ fontWeight: 600 }}>{o.username}</td>
                      <td>{o.name || "—"}</td>
                      <td style={{ color: "var(--dev-text-secondary)" }}>{o.phone || "—"}</td>
                      <td><span className={`${s.badge} ${s.badgeActive}`}>OWNER</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            type="button"
                            className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                            onClick={() => { setEditId(o.userId); setEditName(o.name || ""); setEditPhone(o.phone ?? ""); }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`${s.btn} ${s.btnDanger} ${s.btnSm}`}
                            onClick={() => handleRemove(o.userId, o.username)}
                            disabled={removeOwner.isPending}
                          >
                            Remove
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
