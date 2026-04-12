import { Link } from "react-router-dom";
import { useTenantList } from "@dev/domains/tenants/hooks/useTenants";
import { useMaintenanceMode, useToggleMaintenance } from "@dev/domains/maintenance/hooks/useMaintenance";
import { useDevToast } from "@dev/shared/components/DevToast";
import s from "@dev/layout/DevLayout.module.css";

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
          <span className={s.breadcrumbCurrent}>대시보드</span>
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
              {maintenance.enabledForAll ? "점검 중" : "정상 운영"}
            </span>
          )}
        </div>
      </header>

      <div className={s.content}>
        <div className={s.pageHeader}>
          <h1 className={s.pageTitle}>대시보드</h1>
          <p className={s.pageSub}>Academy SaaS 운영 현황</p>
        </div>

        {/* 통계 카드 */}
        <div className={s.statGrid} style={{ marginBottom: 24 }}>
          <StatCard label="전체 테넌트" value={total} loading={tenantsLoading} />
          <StatCard label="활성" value={active} loading={tenantsLoading} color="var(--dev-success)" />
          <StatCard label="비활성" value={inactive} loading={tenantsLoading} color="var(--dev-text-muted)" />
          <StatCard label="도메인" value={domains} loading={tenantsLoading} color="var(--dev-primary)" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* 점검 모드 카드 */}
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

          {/* 빠른 실행 카드 */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <h3 className={s.cardTitle}>빠른 실행</h3>
            </div>
            <div className={s.cardBody} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link to="/dev/tenants" className={s.btn + " " + s.btnSecondary} style={{ textDecoration: "none", justifyContent: "flex-start" }}>
                <IconTenant /> 테넌트 관리
              </Link>
              <Link to="/admin" className={s.btn + " " + s.btnSecondary} style={{ textDecoration: "none", justifyContent: "flex-start" }}>
                <IconExternal /> 운영 콘솔 열기
              </Link>
            </div>
          </div>
        </div>

        {/* 테넌트 미리보기 */}
        {!tenantsLoading && tenants && tenants.length > 0 && (
          <div className={s.card} style={{ marginTop: 24 }}>
            <div className={s.cardHeader}>
              <h3 className={s.cardTitle}>테넌트 현황</h3>
              <Link to="/dev/tenants" className={s.btn + " " + s.btnGhost + " " + s.btnSm}>
                전체 보기 →
              </Link>
            </div>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>코드</th>
                  <th>도메인</th>
                  <th>상태</th>
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
                        {t.isActive ? "활성" : "비활성"}
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
  return (
    <div className={s.stat}>
      <div className={s.statLabel}>{label}</div>
      {loading ? (
        <div className={s.skeleton} style={{ width: 48, height: 28 }} />
      ) : (
        <div className={s.statValue} style={color ? { color } : undefined}>{value}</div>
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
