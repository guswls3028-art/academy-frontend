/* eslint-disable no-restricted-syntax */
import { Link } from "react-router-dom";
import { useDashboardSummary } from "@dev/domains/dashboard/hooks/useDashboard";
import type { DashboardSummary } from "@dev/domains/dashboard/api/dashboard.api";
import s from "@dev/layout/DevLayout.module.css";

const fmt = (n: number) => n.toLocaleString("ko-KR");
const fmtMoney = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export default function DashboardPage() {
  const { data: summary, isLoading, isError, refetch } = useDashboardSummary();

  return (
    <>
      <header className={s.header}>
        <div className={s.headerLeft}>
          <span className={s.breadcrumbCurrent}>대시보드</span>
        </div>
        <div className={s.headerRight}>
          {summary && (
            <span
              className={s.headerBadge}
              style={{
                background: summary.maintenance.enabled_for_all ? "var(--dev-warning-subtle)" : "var(--dev-success-subtle)",
                color: summary.maintenance.enabled_for_all ? "#92400e" : "#065f46",
              }}
            >
              {summary.maintenance.enabled_for_all ? "점검 중" : "정상 운영"}
            </span>
          )}
        </div>
      </header>

      <div className={s.content}>
        <div className={s.pageHeader}>
          <h1 className={s.pageTitle}>운영 대시보드</h1>
          <p className={s.pageSub}>Academy SaaS 운영 현황 — 1분마다 자동 갱신</p>
        </div>

        {isError && (
          <div className={s.card} style={{ padding: 16, marginBottom: 16, borderColor: "var(--dev-danger)" }}>
            <div style={{ color: "var(--dev-danger)", fontWeight: 600 }}>대시보드 데이터를 불러오지 못했습니다.</div>
            <button className={`${s.btn} ${s.btnSecondary} ${s.btnSm}`} onClick={() => refetch()} style={{ marginTop: 8 }}>
              재시도
            </button>
          </div>
        )}

        <KpiGrid summary={summary} isLoading={isLoading} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          <SignupChart summary={summary} />
          <MaintenanceCard summary={summary} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginTop: 16 }}>
          <RecentActivityCard summary={summary} isLoading={isLoading} />
          <QuickActionsCard />
        </div>
      </div>
    </>
  );
}

/* ===== KPI Grid ===== */
function KpiGrid({ summary, isLoading }: { summary: DashboardSummary | undefined; isLoading: boolean }) {
  const t = summary?.tenants;
  const b = summary?.billing;
  const i = summary?.inbox;
  const u = summary?.users;
  const a = summary?.audit;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
      <Kpi label="MRR" value={b ? fmtMoney(b.mrr) : "—"} loading={isLoading} accent="var(--dev-primary)" />
      <Kpi label="만료 7일 이내" value={b ? fmt(b.expiring_7d) : "—"} loading={isLoading} accent={b && b.expiring_7d > 0 ? "var(--dev-warning)" : undefined} />
      <Kpi label="연체 인보이스" value={b ? fmt(b.overdue_invoices) : "—"} loading={isLoading} accent={b && b.overdue_invoices > 0 ? "var(--dev-danger)" : undefined} />
      <Kpi label="30일 결제액" value={b ? fmtMoney(b.paid_30d) : "—"} loading={isLoading} />
      <Kpi label="활성 테넌트" value={t ? `${fmt(t.active)} / ${fmt(t.total)}` : "—"} loading={isLoading} />
      <Kpi label="신규 가입 7일" value={t ? fmt(t.new_7d) : "—"} loading={isLoading} accent={t && t.new_7d > 0 ? "var(--dev-success)" : undefined} />
      <Kpi label="미답변 문의" value={i ? fmt(i.unanswered) : "—"} loading={isLoading} accent={i && i.unanswered > 0 ? "var(--dev-danger)" : undefined} link="/dev/inbox" />
      <Kpi label="실패 작업 24h" value={a ? fmt(a.failed_24h) : "—"} loading={isLoading} accent={a && a.failed_24h > 0 ? "var(--dev-danger)" : undefined} />
      <Kpi label="신규 사용자 7일" value={u ? fmt(u.signups_7d) : "—"} loading={isLoading} />
    </div>
  );
}

function Kpi({
  label, value, loading, accent, link,
}: { label: string; value: string; loading: boolean; accent?: string; link?: string }) {
  const inner = (
    <div className={s.stat}>
      <div className={s.statLabel}>{label}</div>
      {loading ? (
        <div className={s.skeleton} style={{ width: 60, height: 26 }} />
      ) : (
        <div className={s.statValue} style={accent ? { color: accent, fontVariantNumeric: "tabular-nums" } : { fontVariantNumeric: "tabular-nums" }}>{value}</div>
      )}
    </div>
  );
  if (link) {
    return <Link to={link} style={{ textDecoration: "none", color: "inherit" }}>{inner}</Link>;
  }
  return inner;
}

/* ===== Signup Chart (sparkline-style) ===== */
function SignupChart({ summary }: { summary: DashboardSummary | undefined }) {
  const series = summary?.tenants.signup_series_30d ?? [];

  // 30일치를 패딩 (없는 날은 0). 로컬 타임존 기준 (UTC 변환 시 KST 새벽에 어제 날짜로 빠지는 버그 회피).
  const today = new Date();
  const days: Array<{ date: string; count: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const key = `${yyyy}-${mm}-${dd}`;
    const found = series.find((row) => row.date === key);
    days.push({ date: key, count: found ? found.count : 0 });
  }
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);

  const W = 480;
  const H = 100;
  const stepX = W / (days.length - 1 || 1);
  const points = days.map((d, idx) => `${idx * stepX},${H - (d.count / max) * (H - 8) - 4}`).join(" ");

  return (
    <div className={s.card}>
      <div className={s.cardHeader}>
        <h3 className={s.cardTitle}>신규 테넌트 30일</h3>
        <span style={{ fontSize: 13, color: "var(--dev-text-muted)" }}>합계 {total}</span>
      </div>
      <div className={s.cardBody}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 100 }}>
          <polyline
            fill="none"
            stroke="var(--dev-primary)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
          {days.map((d, idx) => (
            <circle
              key={d.date}
              cx={idx * stepX}
              cy={H - (d.count / max) * (H - 8) - 4}
              r={d.count > 0 ? 2 : 0}
              fill="var(--dev-primary)"
            />
          ))}
        </svg>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--dev-text-muted)", marginTop: 4 }}>
          <span>{days[0]?.date}</span>
          <span>{days[days.length - 1]?.date}</span>
        </div>
      </div>
    </div>
  );
}

/* ===== Maintenance Card ===== */
function MaintenanceCard({
  summary,
}: { summary: DashboardSummary | undefined }) {
  const m = summary?.maintenance;
  return (
    <div className={s.card}>
      <div className={s.cardHeader}>
        <h3 className={s.cardTitle}>점검 모드</h3>
        {m && (
          <span
            className={s.headerBadge}
            style={{
              background: m.enabled_count > 0 ? "var(--dev-warning-subtle)" : "var(--dev-success-subtle)",
              color: m.enabled_count > 0 ? "#92400e" : "#065f46",
            }}
          >
            {m.enabled_count > 0 ? "점검 잔여" : "해제됨"}
          </span>
        )}
      </div>
      <div className={s.cardBody}>
        <p style={{ fontSize: 13, color: "var(--dev-text-secondary)", margin: 0 }}>
          전체 테넌트 점검 ON은 운영 안전상 비활성화되어 있습니다.
        </p>
        {m && (
          <p style={{ fontSize: 12, color: "var(--dev-text-muted)", marginTop: 8 }}>
            적용 {m.enabled_count} / {m.total} 테넌트
          </p>
        )}
      </div>
    </div>
  );
}

/* ===== Recent Activity ===== */
function RecentActivityCard({ summary, isLoading }: { summary: DashboardSummary | undefined; isLoading: boolean }) {
  const items = summary?.audit.recent ?? [];
  return (
    <div className={s.card}>
      <div className={s.cardHeader}>
        <h3 className={s.cardTitle}>최근 활동</h3>
        <span style={{ fontSize: 13, color: "var(--dev-text-muted)" }}>감사 로그 최근 10건</span>
      </div>
      {isLoading ? (
        <div className={s.cardBody}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={s.skeleton} style={{ height: 32, marginBottom: 8 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyText}>최근 활동 없음</div>
        </div>
      ) : (
        <div style={{ padding: "4px 0" }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "grid",
                gridTemplateColumns: "84px 1fr auto",
                gap: 12,
                padding: "8px 20px",
                fontSize: 13,
                alignItems: "center",
                borderBottom: "1px solid var(--dev-border-light)",
              }}
            >
              <span style={{ fontSize: 11, color: "var(--dev-text-muted)" }}>
                {item.created_at ? formatRelative(item.created_at) : "—"}
              </span>
              <div style={{ minWidth: 0 }}>
                <span className={s.code} style={{ marginRight: 6 }}>{item.action}</span>
                <span style={{ color: "var(--dev-text-secondary)" }}>{item.summary || "—"}</span>
                {item.tenant_code && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: "var(--dev-text-muted)" }}>
                    [{item.tenant_code}]
                  </span>
                )}
              </div>
              <span
                style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                  background: item.result === "failed" ? "var(--dev-danger-subtle)" : "var(--dev-success-subtle)",
                  color: item.result === "failed" ? "var(--dev-danger)" : "var(--dev-success)",
                }}
              >
                {item.result === "failed" ? "FAIL" : "OK"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===== Quick Actions ===== */
function QuickActionsCard() {
  return (
    <div className={s.card}>
      <div className={s.cardHeader}>
        <h3 className={s.cardTitle}>빠른 실행</h3>
      </div>
      <div className={s.cardBody} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Link to="/dev/tenants" className={`${s.btn} ${s.btnSecondary}`} style={{ textDecoration: "none", justifyContent: "flex-start" }}>
          🏢 테넌트 관리
        </Link>
        <Link to="/dev/billing" className={`${s.btn} ${s.btnSecondary}`} style={{ textDecoration: "none", justifyContent: "flex-start" }}>
          💳 결제 / 인보이스
        </Link>
        <Link to="/dev/inbox" className={`${s.btn} ${s.btnSecondary}`} style={{ textDecoration: "none", justifyContent: "flex-start" }}>
          📬 문의함
        </Link>
        <Link to="/admin" className={`${s.btn} ${s.btnSecondary}`} style={{ textDecoration: "none", justifyContent: "flex-start" }}>
          🔗 운영 콘솔 열기
        </Link>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}
