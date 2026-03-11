import { Link } from "react-router-dom";
import { useTenantList } from "@/dev_app/hooks/useTenants";
import { useMaintenanceMode, useToggleMaintenance } from "@/dev_app/hooks/useMaintenance";
import { useDevToast } from "@/dev_app/components/DevToast";
import s from "@/dev_app/layout/DevLayout.module.css";

export default function DashboardPage() {
  const { data: tenants, isLoading: tenantsLoading } = useTenantList();
  const { data: maintenance, isLoading: maintenanceLoading } = useMaintenanceMode();
  const toggleMaintenance = useToggleMaintenance();
  const { toast } = useDevToast();

  const total = tenants?.length ?? 0;
  const active = tenants?.filter((t) => t.isActive).length ?? 0;
  const inactive = total - active;
  const domains = tenants?.reduce((acc, t) => acc + (t.domains?.length ?? (t.primaryDomain ? 1 : 0)), 0) ?? 0;

  function handleToggleMaintenance() {
    const next = !maintenance?.enabledForAll;
    toggleMaintenance.mutate(next, {
      onSuccess: () => toast(next ? "점검 모드 활성화" : "점검 모드 해제"),
      onError: () => toast("점검 모드 변경 실패", "error"),
    });
  }

  return (
    <>
      <header className={s.header}>
        <div className={s.headerLeft}>
          <span className={s.breadcrumbCurrent}>Dashboard</span>
        </div>
        <div className={s.headerRight}>
          {!maintenanceLoading && maintenance && (
            <span
              className={s.headerBadge}
              style={{
                background: maintenance.enabledForAll ? "var(--dev-warning-subtle)" : "var(--dev-success-subtle)",
                color: maintenance.enabledForAll ? "#92400e" : "#065f46",
              }}
            >
              {maintenance.enabledForAll ? "Maintenance ON" : "System OK"}
            </span>
          )}
        </div>
      </header>

      <div className={s.content}>
        <div className={s.pageHeader}>
          <h1 className={s.pageTitle}>Dashboard</h1>
          <p className={s.pageSub}>Academy SaaS 운영 현황</p>
        </div>

        {/* Stat Cards */}
        <div className={s.statGrid} style={{ marginBottom: 24 }}>
          <StatCard label="Total Tenants" value={total} loading={tenantsLoading} />
          <StatCard label="Active" value={active} loading={tenantsLoading} color="var(--dev-success)" />
          <StatCard label="Inactive" value={inactive} loading={tenantsLoading} color="var(--dev-text-muted)" />
          <StatCard label="Domains" value={domains} loading={tenantsLoading} color="var(--dev-primary)" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Maintenance Card */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <h3 className={s.cardTitle}>점검 모드</h3>
              {!maintenanceLoading && (
                <button
                  type="button"
                  className={s.toggle}
                  role="switch"
                  aria-checked={maintenance?.enabledForAll ?? false}
                  disabled={toggleMaintenance.isPending}
                  onClick={handleToggleMaintenance}
                >
                  <span className={s.toggleKnob} />
                </button>
              )}
            </div>
            <div className={s.cardBody}>
              <p style={{ fontSize: 13, color: "var(--dev-text-secondary)", margin: 0 }}>
                모든 테넌트에 유지보수 화면을 표시합니다.
              </p>
              {maintenance && (
                <p style={{ fontSize: 12, color: "var(--dev-text-muted)", marginTop: 8 }}>
                  적용: {maintenance.enabledCount}/{maintenance.total} 테넌트
                </p>
              )}
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <h3 className={s.cardTitle}>Quick Actions</h3>
            </div>
            <div className={s.cardBody} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link to="/dev/tenants" className={s.btn + " " + s.btnSecondary} style={{ textDecoration: "none", justifyContent: "flex-start" }}>
                <IconTenant /> Tenant 관리
              </Link>
              <Link to="/admin" className={s.btn + " " + s.btnSecondary} style={{ textDecoration: "none", justifyContent: "flex-start" }}>
                <IconExternal /> 운영 콘솔 열기
              </Link>
            </div>
          </div>
        </div>

        {/* Tenant Overview Table */}
        {!tenantsLoading && tenants && tenants.length > 0 && (
          <div className={s.card} style={{ marginTop: 24 }}>
            <div className={s.cardHeader}>
              <h3 className={s.cardTitle}>Tenants Overview</h3>
              <Link to="/dev/tenants" className={s.btn + " " + s.btnGhost + " " + s.btnSm}>
                View All →
              </Link>
            </div>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Domain</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tenants.slice(0, 5).map((t) => (
                  <tr key={t.id} className={s.tableRow}>
                    <td style={{ fontWeight: 600 }}>
                      <Link to={`/dev/tenants/${t.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                        {t.name}
                      </Link>
                    </td>
                    <td><span className={s.code}>{t.code}</span></td>
                    <td style={{ color: "var(--dev-text-secondary)" }}>{t.primaryDomain || "—"}</td>
                    <td>
                      <span className={`${s.badge} ${t.isActive ? s.badgeActive : s.badgeInactive}`}>
                        <span className={`${s.badgeDot} ${t.isActive ? s.badgeDotActive : s.badgeDotInactive}`} />
                        {t.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function StatCard({ label, value, loading, color }: { label: string; value: number; loading: boolean; color?: string }) {
  const s2 = s;
  return (
    <div className={s2.stat}>
      <div className={s2.statLabel}>{label}</div>
      {loading ? (
        <div className={s2.skeleton} style={{ width: 48, height: 28 }} />
      ) : (
        <div className={s2.statValue} style={color ? { color } : undefined}>{value}</div>
      )}
    </div>
  );
}

function IconTenant() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 16V5l6-3.5L15 5v11" />
      <path d="M1 16h16" />
      <rect x="6" y="8" width="6" height="4" rx="0.5" />
    </svg>
  );
}

function IconExternal() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 10v4.5a1.5 1.5 0 01-1.5 1.5h-8A1.5 1.5 0 012 14.5v-8A1.5 1.5 0 013.5 5H8" />
      <path d="M11 2h5v5" />
      <path d="M7 11L16 2" />
    </svg>
  );
}
