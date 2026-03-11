import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTenantList, useCreateTenant, useUpdateTenant } from "@/dev_app/hooks/useTenants";
import { useRegisterOwner } from "@/dev_app/hooks/useTenants";
import { useDevToast } from "@/dev_app/components/DevToast";
import s from "@/dev_app/layout/DevLayout.module.css";

export default function TenantsPage() {
  const navigate = useNavigate();
  const { data: tenants, isLoading } = useTenantList();
  const createTenant = useCreateTenant();
  const updateTenant = useUpdateTenant();
  const registerOwner = useRegisterOwner();
  const { toast } = useDevToast();

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [withOwner, setWithOwner] = useState(false);
  const [ownerUser, setOwnerUser] = useState("");
  const [ownerPw, setOwnerPw] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");

  const filtered = useMemo(() => {
    if (!tenants) return [];
    if (!search.trim()) return tenants;
    const q = search.trim().toLowerCase();
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        (t.primaryDomain && t.primaryDomain.toLowerCase().includes(q))
    );
  }, [tenants, search]);

  async function handleCreate() {
    if (!newCode.trim() || !newName.trim()) {
      toast("코드와 이름을 입력해주세요.", "error");
      return;
    }
    try {
      const tenant = await createTenant.mutateAsync({
        code: newCode.trim(),
        name: newName.trim(),
        domain: newDomain.trim() || undefined,
      });
      if (withOwner && ownerUser.trim() && ownerPw) {
        try {
          await registerOwner.mutateAsync({
            tenantId: tenant.id,
            username: ownerUser.trim(),
            password: ownerPw,
            name: ownerName.trim() || undefined,
            phone: ownerPhone.trim() || undefined,
          });
          toast(`${newName} 생성 완료. Owner(${ownerUser}) 등록됨.`);
        } catch {
          toast("테넌트 생성됨. Owner 등록 실패.", "error");
        }
      } else {
        toast(`${newName} 생성 완료.`);
      }
      resetCreateForm();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast("생성 실패: " + (err.response?.data?.detail || String(e)), "error");
    }
  }

  function resetCreateForm() {
    setShowCreate(false);
    setNewCode(""); setNewName(""); setNewDomain("");
    setWithOwner(false); setOwnerUser(""); setOwnerPw(""); setOwnerName(""); setOwnerPhone("");
  }

  async function handleToggleActive(id: number, currentlyActive: boolean) {
    try {
      await updateTenant.mutateAsync({ id, isActive: !currentlyActive });
      toast(currentlyActive ? "비활성화됨" : "활성화됨");
    } catch {
      toast("상태 변경 실패", "error");
    }
  }

  return (
    <>
      <header className={s.header}>
        <div className={s.headerLeft}>
          <Link to="/dev/dashboard" style={{ color: "inherit", textDecoration: "none" }}>Dashboard</Link>
          <span className={s.breadcrumbSep}>/</span>
          <span className={s.breadcrumbCurrent}>Tenants</span>
        </div>
      </header>

      <div className={s.content}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div className={s.pageHeader} style={{ marginBottom: 0 }}>
            <h1 className={s.pageTitle}>Tenants</h1>
            <p className={s.pageSub}>{tenants?.length ?? 0}개 테넌트 관리</p>
          </div>
          <button
            type="button"
            className={`${s.btn} ${s.btnPrimary}`}
            onClick={() => setShowCreate(!showCreate)}
          >
            + New Tenant
          </button>
        </div>

        {/* Create Form Modal */}
        {showCreate && (
          <div className={s.overlay} onClick={resetCreateForm}>
            <div className={s.modal} onClick={(e) => e.stopPropagation()}>
              <div className={s.modalHeader}>
                <h2 className={s.modalTitle}>New Tenant</h2>
                <p className={s.modalSub}>새 테넌트를 생성합니다.</p>
              </div>
              <div className={s.modalBody} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label className={s.inputLabel}>Code *</label>
                  <input className={s.input} value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="tchul" />
                </div>
                <div>
                  <label className={s.inputLabel}>Name *</label>
                  <input className={s.input} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="천안학원" />
                </div>
                <div>
                  <label className={s.inputLabel}>Domain</label>
                  <input className={s.input} value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="tchul.com" />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={withOwner} onChange={(e) => setWithOwner(e.target.checked)} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Owner 계정 함께 생성</span>
                </label>
                {withOwner && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingLeft: 2 }}>
                    <div>
                      <label className={s.inputLabel}>Username *</label>
                      <input className={s.input} value={ownerUser} onChange={(e) => setOwnerUser(e.target.value)} />
                    </div>
                    <div>
                      <label className={s.inputLabel}>Password *</label>
                      <input className={s.input} type="password" value={ownerPw} onChange={(e) => setOwnerPw(e.target.value)} />
                    </div>
                    <div>
                      <label className={s.inputLabel}>Name</label>
                      <input className={s.input} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
                    </div>
                    <div>
                      <label className={s.inputLabel}>Phone</label>
                      <input className={s.input} value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
              <div className={s.modalFooter}>
                <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={resetCreateForm}>Cancel</button>
                <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={handleCreate} disabled={createTenant.isPending}>
                  {createTenant.isPending ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search + Table */}
        <div className={s.card}>
          <div className={s.cardHeader}>
            <div className={s.searchWrap} style={{ flex: 1, maxWidth: 320 }}>
              <span className={s.searchIcon}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="7" cy="7" r="5.5" />
                  <path d="M11 11l3.5 3.5" />
                </svg>
              </span>
              <input
                className={s.searchInput}
                placeholder="Search tenants..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {isLoading ? (
            <div className={s.cardBody}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={s.skeleton} style={{ height: 44, marginBottom: 8 }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className={s.empty}>
              <div className={s.emptyIcon}>🏢</div>
              <div className={s.emptyText}>
                {search ? "검색 결과가 없습니다." : "등록된 테넌트가 없습니다."}
              </div>
            </div>
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th style={{ width: 48 }}>ID</th>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Domain</th>
                  <th>Status</th>
                  <th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    className={s.tableRow}
                    onClick={() => navigate(`/dev/tenants/${t.id}`)}
                  >
                    <td style={{ color: "var(--dev-text-muted)" }}>{t.id}</td>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td><span className={s.code}>{t.code}</span></td>
                    <td style={{ color: "var(--dev-text-secondary)" }}>{t.primaryDomain || "—"}</td>
                    <td>
                      <span className={`${s.badge} ${t.isActive ? s.badgeActive : s.badgeInactive}`}>
                        <span className={`${s.badgeDot} ${t.isActive ? s.badgeDotActive : s.badgeDotInactive}`} />
                        {t.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`${s.btn} ${s.btnSm} ${t.isActive ? s.btnDanger : s.btnPrimary}`}
                        disabled={updateTenant.isPending}
                        onClick={() => handleToggleActive(t.id, t.isActive)}
                      >
                        {t.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
