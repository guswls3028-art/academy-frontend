import { useMemo, useState, type CSSProperties } from "react";
import { RefreshCw } from "lucide-react";
import { useTenantList } from "@dev/domains/tenants/hooks/useTenants";
import {
  useProductAnalytics,
} from "../hooks/useProductAnalytics";
import type {
  ProductAnalyticsFeature,
  ProductAnalyticsFilters,
} from "../api/productAnalytics.api";
import {
  PRODUCT_FEATURE_BY_ID,
} from "@/shared/productAnalytics";
import layout from "@dev/layout/DevLayout.module.css";
import s from "./ProductAnalyticsPage.module.css";

const ROLE_OPTIONS = [
  ["", "전체 역할"],
  ["owner", "원장"],
  ["admin", "관리자"],
  ["teacher", "선생님"],
  ["staff", "직원"],
  ["parent", "학부모"],
  ["student", "학생"],
] as const;

const SURFACE_OPTIONS = [
  ["", "전체 화면"],
  ["admin", "통합 업무"],
  ["teacher", "모바일 업무"],
  ["student", "학생·학부모 앱"],
] as const;

const ROLE_LABEL: Record<string, string> = {
  owner: "원장",
  admin: "관리자",
  teacher: "선생님",
  staff: "직원",
  parent: "학부모",
  student: "학생",
};

const PLACEMENT_LABEL: Record<string, string> = {
  sidebar: "왼쪽 메뉴",
  header: "상단 영역",
  navigation: "주 메뉴",
  content: "본문",
};

function placementLabel(value: string): string {
  const exact = PLACEMENT_LABEL[value];
  if (exact) return exact;

  const [surface, section] = value.split(".");
  const surfaceLabel: Record<string, string> = {
    admin: "관리자",
    teacher: "선생님",
    student: "학생·학부모",
  };
  if (surfaceLabel[surface] && section === "navigation") {
    return `${surfaceLabel[surface]} 주 메뉴`;
  }
  return "기타 위치";
}

function count(value: number | null | undefined): string {
  return value == null ? "—" : value.toLocaleString("ko-KR");
}

function percent(value: number | null | undefined): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function observedAt(value: string | null): string {
  if (!value) return "관측 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function recommendation(feature: ProductAnalyticsFeature): {
  label: string;
  tone: "good" | "watch" | "fix" | "quiet";
} {
  const registry = PRODUCT_FEATURE_BY_ID.get(feature.feature_id);
  if (feature.visits === 0) return { label: "노출 경로 확인", tone: "quiet" };
  if (
    feature.starts > 0
    && feature.completion_rate != null
    && feature.completion_rate < 0.7
  ) {
    return { label: "완료 흐름 먼저 수정", tone: "fix" };
  }
  if (
    feature.engagement_rate != null
    && feature.engagement_rate < 0.05
  ) {
    return registry?.strategicPriority === "core"
      ? { label: "발견성·안내 실험", tone: "watch" }
      : { label: "하위 노출 검토", tone: "quiet" };
  }
  if (
    feature.engagement_rate != null
    && feature.engagement_rate >= 0.3
    && (feature.completion_rate == null || feature.completion_rate >= 0.8)
  ) {
    return { label: "빠른 진입 유지", tone: "good" };
  }
  return { label: "기준선 유지", tone: "quiet" };
}

function Signal({
  label,
  value,
  strength,
  tone = "blue",
}: {
  label: string;
  value: string;
  strength: number;
  tone?: "blue" | "green" | "red";
}) {
  const style = {
    "--signal-strength": `${Math.max(0, Math.min(100, strength))}%`,
  } as CSSProperties;
  return (
    <div className={s.signal}>
      <div className={s.signalTop}>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className={s.signalTrack}>
        <span className={`${s.signalFill} ${s[tone]}`} style={style} />
      </div>
    </div>
  );
}

export default function ProductAnalyticsPage() {
  const [filters, setFilters] = useState<ProductAnalyticsFilters>({ days: 28 });
  const { data, isLoading, isError, isFetching, refetch } =
    useProductAnalytics(filters);
  const { data: tenants = [] } = useTenantList();
  const maxVisits = useMemo(
    () => Math.max(1, ...(data?.features.map((item) => item.visits) ?? [1])),
    [data?.features],
  );

  return (
    <>
      <header className={layout.header}>
        <div className={layout.headerLeft}>
          <span className={layout.breadcrumbCurrent}>기능 사용 신호</span>
        </div>
        <div className={layout.headerRight}>
          <span className={layout.headerBadge}>
            {data ? `${data.period.start} – ${data.period.end}` : "기준선 준비"}
          </span>
        </div>
      </header>

      <main className={layout.content}>
        <div className={s.pageIntro}>
          <div>
            <p className={s.eyebrow}>PRODUCT SIGNALS</p>
            <h1 className={layout.pageTitle}>어디에 진입점을 둘지 판단합니다</h1>
            <p className={layout.pageSub}>
              역할별 방문, 참여, 실제 완료를 함께 보고 메뉴와 CTA의 우선순위를 정합니다.
            </p>
          </div>
          <button
            type="button"
            className={`${layout.btn} ${layout.btnSecondary}`}
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw size={15} aria-hidden />
            {isFetching ? "갱신 중" : "새로고침"}
          </button>
        </div>

        <section className={s.filters} aria-label="사용 분석 필터">
          <label>
            <span>기간</span>
            <select
              value={filters.days}
              onChange={(event) => setFilters((current) => ({
                ...current,
                days: Number(event.target.value) as 7 | 28 | 90,
              }))}
            >
              <option value={7}>최근 7일</option>
              <option value={28}>최근 28일</option>
              <option value={90}>최근 90일</option>
            </select>
          </label>
          <label>
            <span>역할</span>
            <select
              value={filters.role ?? ""}
              onChange={(event) => setFilters((current) => ({
                ...current,
                role: event.target.value || undefined,
              }))}
            >
              {ROLE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>화면</span>
            <select
              value={filters.surface ?? ""}
              onChange={(event) => setFilters((current) => ({
                ...current,
                surface: event.target.value || undefined,
              }))}
            >
              {SURFACE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className={s.tenantFilter}>
            <span>테넌트</span>
            <select
              value={filters.tenantId ?? ""}
              onChange={(event) => setFilters((current) => ({
                ...current,
                tenantId: event.target.value
                  ? Number(event.target.value)
                  : undefined,
              }))}
            >
              <option value="">전체 테넌트</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.code})
                </option>
              ))}
            </select>
          </label>
        </section>

        {isError && (
          <section className={s.errorState} role="alert">
            <strong>사용 분석 데이터를 불러오지 못했습니다.</strong>
            <span>잠시 후 다시 시도하거나 수집 API 상태를 확인해 주세요.</span>
          </section>
        )}

        {data?.suppressed && (
          <section className={s.notice}>
            선택한 테넌트의 고유 사용자가 5명 미만이라 세부 수치를 숨겼습니다.
          </section>
        )}

        <section className={s.kpis} aria-label="핵심 사용 지표">
          <article>
            <span>역할 활성 사용자</span>
            <strong>{isLoading ? "…" : count(data?.summary.active_actors)}</strong>
            <small>선택 기간 고유 사용자</small>
          </article>
          <article>
            <span>화면 방문</span>
            <strong>{isLoading ? "…" : count(data?.summary.screen_views)}</strong>
            <small>중복 방문 포함</small>
          </article>
          <article>
            <span>10초 참여율</span>
            <strong>{isLoading ? "…" : percent(data?.summary.engagement_rate)}</strong>
            <small>방문 후 실제 체류</small>
          </article>
          <article>
            <span>작업 완료율</span>
            <strong>{isLoading ? "…" : percent(data?.summary.task_completion_rate)}</strong>
            <small>시작 대비 서버 성공</small>
          </article>
          <article>
            <span>작업 실패율</span>
            <strong className={s.dangerValue}>
              {isLoading ? "…" : percent(data?.summary.task_failure_rate)}
            </strong>
            <small>노출 확대 전 확인</small>
          </article>
        </section>

        <section className={s.roleStrip}>
          <div>
            <span className={s.sectionKicker}>역할 분포</span>
            <strong>같은 기능도 역할마다 진입 방식이 다릅니다</strong>
          </div>
          <div className={s.rolePills}>
            {data?.roles.length ? data.roles.map((row) => (
              <span key={row.role}>
                {ROLE_LABEL[row.role] ?? row.role}
                <strong>{count(row.active_actors)}</strong>
              </span>
            )) : <span>집계된 역할 데이터가 없습니다</span>}
          </div>
        </section>

        <section className={s.featureSection}>
          <div className={s.sectionHeader}>
            <div>
              <span className={s.sectionKicker}>기능별 신호 레일</span>
              <h2>발견성 → 참여 → 완료</h2>
            </div>
            <p>한 지표만 높아도 우선순위를 자동으로 바꾸지 않습니다.</p>
          </div>

          {isLoading ? (
            <div className={s.loadingRows}>
              {[1, 2, 3, 4].map((item) => <span key={item} />)}
            </div>
          ) : !data?.features.length ? (
            <div className={s.emptyState}>
              <strong>아직 집계된 기능 사용이 없습니다.</strong>
              <span>기능 플래그를 켠 뒤 일별 집계가 완료되면 여기에 표시됩니다.</span>
            </div>
          ) : (
            <div className={s.featureList}>
              {data.features.map((feature) => {
                const meta = PRODUCT_FEATURE_BY_ID.get(feature.feature_id);
                const action = recommendation(feature);
                return (
                  <article className={s.featureRow} key={feature.feature_id}>
                    <div className={s.featureIdentity}>
                      <strong>{meta?.label ?? "등록된 기능"}</strong>
                      <span>
                        사용자 {count(feature.unique_actors)}
                        {" · "}
                        최근 {observedAt(feature.last_observed_at)}
                      </span>
                    </div>
                    <div className={s.signalRail}>
                      <Signal
                        label="방문"
                        value={count(feature.visits)}
                        strength={(feature.visits / maxVisits) * 100}
                      />
                      <Signal
                        label="참여"
                        value={percent(feature.engagement_rate)}
                        strength={(feature.engagement_rate ?? 0) * 100}
                        tone="green"
                      />
                      <Signal
                        label="완료"
                        value={percent(feature.completion_rate)}
                        strength={(feature.completion_rate ?? 0) * 100}
                        tone={
                          feature.completion_rate != null
                          && feature.completion_rate < 0.7
                            ? "red"
                            : "green"
                        }
                      />
                    </div>
                    <span className={`${s.recommendation} ${s[action.tone]}`}>
                      {action.label}
                    </span>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className={s.lowerGrid}>
          <section className={s.dataCard}>
            <div className={s.sectionHeader}>
              <div>
                <span className={s.sectionKicker}>CTA 위치</span>
                <h2>보였을 때 선택됐는가</h2>
              </div>
            </div>
            {!data?.ctas.length ? (
              <div className={s.emptyCompact}>집계된 CTA가 없습니다.</div>
            ) : (
              <div className={s.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>기능</th>
                      <th>위치</th>
                      <th>노출</th>
                      <th>클릭률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ctas.slice(0, 12).map((cta) => (
                      <tr key={`${cta.cta_id}:${cta.placement_id}:${cta.position_index}`}>
                        <td>{PRODUCT_FEATURE_BY_ID.get(cta.feature_id)?.label ?? "등록된 기능"}</td>
                        <td>{placementLabel(cta.placement_id)}</td>
                        <td>{count(cta.impressions)}</td>
                        <td>{percent(cta.click_rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className={s.dataCard}>
            <div className={s.sectionHeader}>
              <div>
                <span className={s.sectionKicker}>수집 품질</span>
                <h2>판단 전에 데이터부터 확인</h2>
              </div>
            </div>
            <dl className={s.qualityList}>
              <div><dt>원본 이벤트</dt><dd>{count(data?.quality.raw_events)}</dd></div>
              <div><dt>합성 트래픽</dt><dd>{count(data?.quality.synthetic_events)}</dd></div>
              <div><dt>대리 로그인</dt><dd>{count(data?.quality.impersonated_events)}</dd></div>
              <div><dt>마지막 수신</dt><dd>{observedAt(data?.quality.last_received_at ?? null)}</dd></div>
            </dl>
          </section>
        </div>
      </main>
    </>
  );
}
