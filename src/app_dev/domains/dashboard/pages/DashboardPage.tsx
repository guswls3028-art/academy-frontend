import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Inbox,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";
import { useDashboardSummary } from "@dev/domains/dashboard/hooks/useDashboard";
import type { DashboardSummary } from "@dev/domains/dashboard/api/dashboard.api";
import layout from "@dev/layout/DevLayout.module.css";
import s from "./DashboardPage.module.css";

const fmt = (n: number) => n.toLocaleString("ko-KR");
const fmtMoney = (n: number) => `${n.toLocaleString("ko-KR")}원`;

type Tone = "neutral" | "good" | "watch" | "danger";

type ActionItem = {
  title: string;
  detail: string;
  value: string;
  tone: Tone;
  href: string;
  icon: LucideIcon;
};

export default function DashboardPage() {
  const {
    data: summary,
    isLoading,
    isError,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useDashboardSummary();
  const actionItems = getActionItems(summary);
  const urgentCount = actionItems.filter((item) => item.tone === "danger" || item.tone === "watch").length;

  return (
    <>
      <header className={layout.header}>
        <div className={layout.headerLeft}>
          <span className={layout.breadcrumbCurrent}>운영 대시보드</span>
        </div>
        <div className={layout.headerRight}>
          <span className={`${layout.headerBadge} ${s.headerStatus}`} data-tone={urgentCount > 0 ? "watch" : "good"}>
            <span aria-hidden />
            {isLoading ? "상태 확인 중" : isError ? "상태 확인 실패" : urgentCount > 0 ? `확인 필요 ${urgentCount}` : "정상 운영"}
          </span>
        </div>
      </header>

      <main className={`${layout.content} ${s.dashboard}`}>
        <section className={s.hero} aria-labelledby="dashboard-title">
          <div className={s.heroCopy}>
            <p className={s.eyebrow}>PLATFORM COMMAND CENTER</p>
            <h1 id="dashboard-title" className={layout.pageTitle}>운영 대시보드</h1>
            <p className={layout.pageSub}>매출, 테넌트, 고객 요청, 자동화 실패를 한 흐름에서 판단합니다.</p>
          </div>
          <div className={s.heroControls}>
            <div className={s.refreshMeta} aria-live="polite">
              <span>마지막 동기화</span>
              <strong>{dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("ko-KR") : "확인 중"}</strong>
              <small>60초 자동 갱신</small>
            </div>
            <button
              type="button"
              className={`${layout.btn} ${layout.btnSecondary} ${s.refreshButton}`}
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw size={15} className={isFetching ? s.spinning : undefined} aria-hidden />
              {isFetching ? "갱신 중" : "새로고침"}
            </button>
          </div>
        </section>

        {isError && (
          <section className={s.errorPanel} role="alert">
            <TriangleAlert size={18} aria-hidden />
            <div>
              <strong>운영 데이터를 불러오지 못했습니다.</strong>
              <span>수치를 추정하지 않습니다. 연결을 확인한 뒤 다시 시도해 주세요.</span>
            </div>
            <button type="button" className={`${layout.btn} ${layout.btnSecondary} ${layout.btnSm}`} onClick={() => void refetch()}>
              다시 시도
            </button>
          </section>
        )}

        <section className={s.commandBrief} data-tone={urgentCount > 0 ? "watch" : "good"} aria-label="오늘의 운영 요약">
          <div className={s.commandIcon}>
            {urgentCount > 0 ? <TriangleAlert aria-hidden /> : <ShieldCheck aria-hidden />}
          </div>
          <div className={s.commandCopy}>
            <span>오늘의 운영 요약</span>
            <strong>{isLoading ? "운영 신호를 정리하고 있습니다" : urgentCount > 0 ? `${urgentCount}개 항목을 우선 확인하세요` : "즉시 조치가 필요한 신호가 없습니다"}</strong>
            <small>{isLoading ? "각 운영 경계의 최신 데이터를 조회 중입니다." : urgentCount > 0 ? "연체·만료·미처리·실패 신호를 영향도 순으로 모았습니다." : "현재 기준으로 결제, 문의, 자동화 경계가 안정적입니다."}</small>
          </div>
          <div className={s.commandFacts}>
            <span><b>{summary ? fmt(summary.tenants.active) : "—"}</b> 활성 테넌트</span>
            <span><b>{summary ? fmt(summary.users.total) : "—"}</b> 전체 사용자</span>
            <span><b>{summary ? fmt(summary.audit.failed_24h) : "—"}</b> 24시간 실패</span>
          </div>
        </section>

        <KpiGrid summary={summary} isLoading={isLoading} />

        <section className={s.primaryGrid}>
          <PriorityQueue items={actionItems} isLoading={isLoading} />
          <SignupChart summary={summary} isLoading={isLoading} />
        </section>

        <section className={s.secondaryGrid}>
          <RecentActivityCard summary={summary} isLoading={isLoading} />
          <aside className={s.sideStack}>
            <MaintenanceCard summary={summary} isLoading={isLoading} />
            <QuickActionsCard />
          </aside>
        </section>
      </main>
    </>
  );
}

function KpiGrid({ summary, isLoading }: { summary: DashboardSummary | undefined; isLoading: boolean }) {
  const t = summary?.tenants;
  const b = summary?.billing;
  const i = summary?.inbox;
  const u = summary?.users;
  const a = summary?.audit;
  const primary = [
    { label: "MRR", qualifier: "VAT 별도", value: b ? fmtMoney(b.mrr_supply_amount ?? b.mrr) : "—", icon: CircleDollarSign, tone: "neutral" as Tone },
    { label: "활성 테넌트", qualifier: t ? `전체 ${fmt(t.total)}` : "전체 —", value: t ? fmt(t.active) : "—", icon: Building2, tone: "good" as Tone },
    { label: "30일 결제액", qualifier: "입금 완료", value: b ? fmtMoney(b.paid_30d) : "—", icon: Activity, tone: "neutral" as Tone },
    { label: "신규 사용자 7일", qualifier: u ? `전체 ${fmt(u.total)}` : "전체 —", value: u ? fmt(u.signups_7d) : "—", icon: Users, tone: "neutral" as Tone },
  ];
  const signals = [
    { label: "만료 7일 이내", value: b ? fmt(b.expiring_7d) : "—", tone: b && b.expiring_7d > 0 ? "watch" as Tone : "good" as Tone, href: "/dev/billing" },
    { label: "연체 인보이스", value: b ? fmt(b.overdue_invoices) : "—", tone: b && b.overdue_invoices > 0 ? "danger" as Tone : "good" as Tone, href: "/dev/billing" },
    { label: "신규 가입 7일", value: t ? fmt(t.new_7d) : "—", tone: "neutral" as Tone, href: "/dev/tenants" },
    { label: "미답변 문의", value: i ? fmt(i.unanswered) : "—", tone: i && i.unanswered > 0 ? "watch" as Tone : "good" as Tone, href: "/dev/inbox" },
    { label: "실패 작업 24h", value: a ? fmt(a.failed_24h) : "—", tone: a && a.failed_24h > 0 ? "danger" as Tone : "good" as Tone, href: "/dev/automation" },
  ];

  return (
    <section aria-label="핵심 운영 지표">
      <div className={s.metricGrid}>
        {primary.map((metric) => (
          <article className={s.metricCard} data-tone={metric.tone} key={metric.label}>
            <div className={s.metricTop}>
              <span>{metric.label}</span>
              <metric.icon size={17} strokeWidth={1.7} aria-hidden />
            </div>
            {isLoading ? <div className={`${layout.skeleton} ${s.metricSkeleton}`} /> : <strong>{metric.value}</strong>}
            <small>{metric.qualifier}</small>
          </article>
        ))}
      </div>
      <div className={s.signalStrip} aria-label="주의 신호">
        {signals.map((signal) => (
          <Link to={signal.href} className={s.signalItem} data-tone={signal.tone} key={signal.label}>
            <span>{signal.label}</span>
            {isLoading ? <i className={`${layout.skeleton} ${s.signalSkeleton}`} /> : <strong>{signal.value}</strong>}
            <ArrowRight size={13} aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  );
}

function PriorityQueue({ items, isLoading }: { items: ActionItem[]; isLoading: boolean }) {
  return (
    <section className={`${layout.card} ${s.priorityCard}`}>
      <div className={s.sectionHeader}>
        <div>
          <p>PRIORITY QUEUE</p>
          <h2>우선 확인 항목</h2>
        </div>
        <span>{isLoading ? "확인 중" : `${items.length}개 경계`}</span>
      </div>
      {isLoading ? (
        <div className={s.queueSkeletons}>
          {[1, 2, 3].map((item) => <div key={item} className={`${layout.skeleton} ${s.queueSkeleton}`} />)}
        </div>
      ) : (
        <div className={s.actionList}>
          {items.map((item) => (
            <Link to={item.href} className={s.actionRow} data-tone={item.tone} key={item.title}>
              <div className={s.actionIcon}><item.icon size={17} strokeWidth={1.8} aria-hidden /></div>
              <div className={s.actionCopy}>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </div>
              <b>{item.value}</b>
              <ArrowRight size={15} aria-hidden />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function SignupChart({ summary, isLoading }: { summary: DashboardSummary | undefined; isLoading: boolean }) {
  const days = buildThirtyDaySeries(summary?.tenants.signup_series_30d ?? []);
  const max = Math.max(1, ...days.map((day) => day.count));
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const width = 600;
  const height = 146;
  const stepX = width / (days.length - 1 || 1);
  const points = days.map((day, index) => `${index * stepX},${height - (day.count / max) * (height - 20) - 8}`).join(" ");
  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <section className={`${layout.card} ${s.chartCard}`}>
      <div className={s.sectionHeader}>
        <div>
          <p>30-DAY TREND</p>
          <h2>신규 테넌트 30일</h2>
        </div>
        <span><b>{isLoading ? "—" : total}</b> 합계</span>
      </div>
      <div className={s.chartBody}>
        {isLoading ? (
          <div className={`${layout.skeleton} ${s.chartSkeleton}`} />
        ) : (
          <>
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`최근 30일 신규 테넌트 ${total}개`}>
              <line x1="0" y1={height - 1} x2={width} y2={height - 1} className={s.chartBaseline} />
              <polygon points={areaPoints} className={s.chartArea} />
              <polyline points={points} className={s.chartLine} />
              {days.map((day, index) => day.count > 0 ? (
                <circle key={day.date} cx={index * stepX} cy={height - (day.count / max) * (height - 20) - 8} r="3" className={s.chartPoint} />
              ) : null)}
            </svg>
            <div className={s.chartAxis}><span>{shortDate(days[0]?.date)}</span><span>{shortDate(days[days.length - 1]?.date)}</span></div>
          </>
        )}
      </div>
    </section>
  );
}

function RecentActivityCard({ summary, isLoading }: { summary: DashboardSummary | undefined; isLoading: boolean }) {
  const items = summary?.audit.recent ?? [];
  return (
    <section className={`${layout.card} ${s.activityCard}`}>
      <div className={s.sectionHeader}>
        <div>
          <p>AUDIT LEDGER</p>
          <h2>최근 활동</h2>
        </div>
        <Link to="/dev/automation">감사 로그 전체 보기 <ArrowRight size={13} /></Link>
      </div>
      {isLoading ? (
        <div className={s.activitySkeletons}>{[1, 2, 3].map((item) => <div key={item} className={`${layout.skeleton} ${s.activitySkeleton}`} />)}</div>
      ) : items.length === 0 ? (
        <div className={s.emptyState}><CheckCircle2 size={22} /><strong>최근 활동이 없습니다</strong><span>새 운영 작업이 기록되면 이곳에 표시됩니다.</span></div>
      ) : (
        <div className={s.activityList}>
          {items.map((item) => (
            <article className={s.activityRow} key={item.id}>
              <time>{item.created_at ? formatRelative(item.created_at) : "—"}</time>
              <div>
                <code>{item.action}</code>
                <span>{item.summary || "요약 없음"}</span>
              </div>
              {item.tenant_code ? <code>{item.tenant_code}</code> : <span>플랫폼</span>}
              <b data-result={item.result}>{item.result === "failed" ? "FAIL" : "OK"}</b>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MaintenanceCard({ summary, isLoading }: { summary: DashboardSummary | undefined; isLoading: boolean }) {
  const maintenance = summary?.maintenance;
  const enabled = (maintenance?.enabled_count ?? 0) > 0;
  return (
    <section className={`${layout.card} ${s.postureCard}`}>
      <div className={s.sectionHeader}>
        <div>
          <p>PLATFORM POSTURE</p>
          <h2>점검 모드</h2>
        </div>
        <span className={s.postureBadge} data-tone={enabled ? "watch" : "good"}>{isLoading ? "확인 중" : enabled ? "일부 적용" : "해제됨"}</span>
      </div>
      <div className={s.postureBody}>
        <div className={s.postureRing} data-tone={enabled ? "watch" : "good"}>
          {isLoading ? "—" : maintenance ? maintenance.total - maintenance.enabled_count : "—"}
          <span>정상</span>
        </div>
        <div>
          <strong>{enabled ? `${maintenance?.enabled_count ?? 0}개 테넌트 점검 중` : "전체 테넌트 정상 접근"}</strong>
          <span>전체 점검 ON은 운영 안전상 비활성화되어 있습니다.</span>
        </div>
      </div>
    </section>
  );
}

function QuickActionsCard() {
  const actions = [
    { to: "/dev/tenants", label: "테넌트 관리", detail: "계정·도메인·사용량", icon: Building2 },
    { to: "/dev/billing", label: "결제 관리", detail: "구독·인보이스", icon: CircleDollarSign },
    { to: "/dev/inbox", label: "문의 운영함", detail: "미처리 고객 요청", icon: Inbox },
    { to: "/dev/automation", label: "자동화", detail: "감사 로그·크론", icon: Workflow },
  ];
  return (
    <section className={`${layout.card} ${s.quickCard}`}>
      <div className={s.sectionHeader}><div><p>SHORTCUTS</p><h2>빠른 실행</h2></div></div>
      <div className={s.quickGrid}>
        {actions.map((action) => (
          <Link to={action.to} key={action.to}>
            <action.icon size={17} strokeWidth={1.8} />
            <span><strong>{action.label}</strong><small>{action.detail}</small></span>
            <ArrowRight size={14} />
          </Link>
        ))}
      </div>
    </section>
  );
}

function getActionItems(summary: DashboardSummary | undefined): ActionItem[] {
  if (!summary) return [];
  return [
    {
      title: summary.billing.overdue_invoices > 0 ? "연체 인보이스 확인" : "연체 인보이스",
      detail: summary.billing.overdue_invoices > 0 ? "수납 상태와 구독 영향을 확인하세요." : "미처리 연체 건이 없습니다.",
      value: `${fmt(summary.billing.overdue_invoices)}건`,
      tone: summary.billing.overdue_invoices > 0 ? "danger" : "good",
      href: "/dev/billing",
      icon: CircleDollarSign,
    },
    {
      title: summary.inbox.unanswered > 0 ? "미답변 문의 처리" : "문의 응답 상태",
      detail: summary.inbox.unanswered > 0 ? "고객 대기 시간이 길어지기 전에 분류하세요." : "답변을 기다리는 문의가 없습니다.",
      value: `${fmt(summary.inbox.unanswered)}건`,
      tone: summary.inbox.unanswered > 0 ? "watch" : "good",
      href: "/dev/inbox",
      icon: Inbox,
    },
    {
      title: summary.audit.failed_24h > 0 ? "자동화 실패 조사" : "자동화 실행 상태",
      detail: summary.audit.failed_24h > 0 ? "최근 실패 액션과 오류 요약을 확인하세요." : "최근 24시간 실패 작업이 없습니다.",
      value: `${fmt(summary.audit.failed_24h)}건`,
      tone: summary.audit.failed_24h > 0 ? "danger" : "good",
      href: "/dev/automation",
      icon: Workflow,
    },
    {
      title: summary.billing.expiring_7d > 0 ? "구독 만료 예정 점검" : "구독 만료 예정",
      detail: summary.billing.expiring_7d > 0 ? "7일 안에 만료되는 테넌트의 갱신 여부를 확인하세요." : "7일 안에 만료되는 테넌트가 없습니다.",
      value: `${fmt(summary.billing.expiring_7d)}개`,
      tone: summary.billing.expiring_7d > 0 ? "watch" : "good",
      href: "/dev/billing",
      icon: Clock3,
    },
  ];
}

function buildThirtyDaySeries(series: Array<{ date: string; count: number }>) {
  const today = new Date();
  const days: Array<{ date: string; count: number }> = [];
  for (let offset = 29; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    days.push({ date: key, count: series.find((row) => row.date === key)?.count ?? 0 });
  }
  return days;
}

function shortDate(date: string | undefined): string {
  if (!date) return "—";
  return `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  const date = new Date(iso);
  return `${date.getMonth() + 1}.${date.getDate()}`;
}
