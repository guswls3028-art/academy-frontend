import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock3, Plus, RefreshCw } from "lucide-react";

import type { ArrivalOverview, ArrivalOverviewItem } from "@/shared/api/contracts/arrivalOverview";
import styles from "./ArrivalOperationsBoard.module.css";

type ArrivalOperationsBoardProps = {
  data?: ArrivalOverview;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onNavigate: (item: ArrivalOverviewItem) => void;
  onOpenSupplement: () => void;
  onOpenClinic: () => void;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "long",
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

function localDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function itemDateTime(item: ArrivalOverviewItem): Date | null {
  if (!item.date || !item.time) return null;
  const [year, month, day] = item.date.split("-").map(Number);
  const [hour, minute] = item.time.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  return new Date(year, month - 1, day, hour, minute);
}

function sourceLabel(source: ArrivalOverviewItem["source"]): string {
  return source === "supplement" ? "보강" : "클리닉";
}

function groupByTime(items: ArrivalOverviewItem[]) {
  const groups = new Map<string, ArrivalOverviewItem[]>();
  for (const item of items) {
    const key = item.time ?? "시간 미정";
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return Array.from(groups.entries());
}

function groupByDate(items: ArrivalOverviewItem[]) {
  const groups = new Map<string, ArrivalOverviewItem[]>();
  for (const item of items) {
    if (!item.date) continue;
    const group = groups.get(item.date) ?? [];
    group.push(item);
    groups.set(item.date, group);
  }
  return Array.from(groups.entries());
}

function nextArrival(data: ArrivalOverview): ArrivalOverviewItem | undefined {
  const generatedAt = new Date(data.generated_at);
  return data.items.find((item) => {
    const at = itemDateTime(item);
    return at != null && at >= generatedAt && !item.is_resolved;
  });
}

function nextArrivalCopy(data: ArrivalOverview, item: ArrivalOverviewItem): string {
  if (item.date === data.today) return `${item.time} · ${item.student_name}`;
  if (!item.date) return `${item.time} · ${item.student_name}`;
  return `${SHORT_DATE_FORMATTER.format(localDate(item.date))} ${item.time} · ${item.student_name}`;
}

export function ArrivalOperationsBoard({
  data,
  loading,
  error,
  onRetry,
  onNavigate,
  onOpenSupplement,
  onOpenClinic,
}: ArrivalOperationsBoardProps) {
  if (loading) {
    return (
      <section id="arrival-overview" className={styles.board} aria-label="등원 예정 불러오는 중">
        <div className={styles.loadingLine} />
        <div className={styles.loadingGrid}>
          <span /><span /><span />
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section id="arrival-overview" className={`${styles.board} ${styles.errorBoard}`} aria-label="등원 예정 오류">
        <AlertTriangle size={22} aria-hidden />
        <div>
          <strong>등원 예정 현황을 불러오지 못했습니다.</strong>
          <span>다시 불러오면 보강과 클리닉 일정을 함께 확인할 수 있습니다.</span>
        </div>
        <button type="button" onClick={onRetry}>
          <RefreshCw size={15} aria-hidden /> 다시 불러오기
        </button>
      </section>
    );
  }

  const todayItems = data.items.filter((item) => item.date === data.today);
  const hasArrivals = data.items.length > 0;

  if (!hasArrivals) {
    return (
      <section
        id="arrival-overview"
        className={`${styles.board} ${styles.emptyBoard}`}
        aria-labelledby="arrival-overview-title"
      >
        <div className={styles.emptyCopy}>
          <span className={styles.dateLabel}>
            <CalendarClock size={15} aria-hidden />
            오늘부터 {data.range_days}일
          </span>
          <h2 id="arrival-overview-title">예정된 보강·클리닉 등원이 없습니다.</h2>
          <p>일정을 입력하면 준비할 학생과 시간을 이곳에서 바로 확인할 수 있습니다.</p>
        </div>
        <div className={styles.emptyActions}>
          <button type="button" onClick={onOpenSupplement}>
            <Plus size={14} aria-hidden /> 강의에서 보강 입력
          </button>
          <button type="button" onClick={onOpenClinic}>
            클리닉 예약 보기 <ArrowRight size={14} aria-hidden />
          </button>
        </div>
      </section>
    );
  }

  const next = nextArrival(data);
  const nextAt = next ? itemDateTime(next) : null;
  const generatedAt = new Date(data.generated_at);
  const minutesUntilNext = nextAt
    ? Math.max(0, Math.round((nextAt.getTime() - generatedAt.getTime()) / 60_000))
    : null;

  const summary = [
    ...(data.summary.soon > 0 ? [{ label: "1시간 내", value: data.summary.soon, tone: "soon" }] : []),
    { label: "오늘", value: data.summary.today, tone: "today" },
    ...(data.summary.tomorrow > 0 ? [{ label: "내일", value: data.summary.tomorrow, tone: "tomorrow" }] : []),
    { label: `${data.range_days}일`, value: data.summary.upcoming, tone: "upcoming" },
    ...(data.summary.time_unset > 0 ? [{ label: "시간 미정", value: data.summary.time_unset, tone: "unset" }] : []),
  ];

  return (
    <section id="arrival-overview" className={styles.board} aria-labelledby="arrival-overview-title">
      <header className={styles.header}>
        <div>
          <span className={styles.dateLabel}>
            <CalendarClock size={15} aria-hidden />
            {DATE_FORMATTER.format(localDate(data.today))}
          </span>
          <h2 id="arrival-overview-title">오늘 등원 예정</h2>
          <p>보강과 클리닉을 시간 순서대로 확인하고 바로 준비하세요.</p>
        </div>
        <div className={styles.nextArrival} data-empty={next ? "false" : "true"}>
          <span>다음 등원</span>
          {next ? (
            <>
              <strong>{nextArrivalCopy(data, next)}</strong>
              <small>
                {next.date === data.today && minutesUntilNext != null ? `${minutesUntilNext}분 뒤 · ` : ""}
                {sourceLabel(next.source)}
              </small>
            </>
          ) : (
            <>
              <strong>남은 예정 없음</strong>
              <small>새 일정은 자동으로 여기에 표시됩니다.</small>
            </>
          )}
        </div>
      </header>

      <div className={styles.summary} aria-label="등원 예정 요약">
        {summary.map((item) => (
          <span key={item.label} data-tone={item.tone}>
            <small>{item.label}</small>
            <strong>{item.value}<em>명</em></strong>
          </span>
        ))}
        {data.summary.overdue > 0 ? (
          <span data-tone="overdue">
            <small>예정 시간 지남</small>
            <strong>{data.summary.overdue}<em>명</em></strong>
          </span>
        ) : null}
      </div>

      {todayItems.length === 0 ? (
        <div className={styles.todayEmpty}>
          <CheckCircle2 size={22} aria-hidden />
          <div>
            <strong>오늘은 예정된 비정규 등원이 없습니다.</strong>
            <span>오른쪽의 이후 일정을 미리 준비해 두세요.</span>
          </div>
        </div>
      ) : (
        <div className={styles.timeline} aria-label="오늘 시간대별 등원 예정">
          {groupByTime(todayItems).map(([time, items]) => (
            <div key={time} className={styles.timelineRow} data-unset={time === "시간 미정" ? "true" : "false"}>
              <div className={styles.timeLabel}>
                <Clock3 size={14} aria-hidden />
                <strong>{time}</strong>
              </div>
              <div className={styles.arrivals}>
                {items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={styles.arrivalItem}
                    data-source={item.source}
                    data-overdue={item.is_overdue ? "true" : "false"}
                    data-resolved={item.is_resolved ? "true" : "false"}
                    onClick={() => onNavigate(item)}
                    aria-label={`${item.student_name} ${sourceLabel(item.source)} 상세로 이동`}
                  >
                    <span className={styles.sourceBadge}>{sourceLabel(item.source)}</span>
                    <span className={styles.arrivalCopy}>
                      <strong>{item.student_name}</strong>
                      <small>
                        {[item.lecture_title, item.location, item.memo].filter(Boolean).join(" · ") || "세부 메모 없음"}
                      </small>
                    </span>
                    {item.is_overdue ? <span className={styles.stateBadge}>확인 필요</span> : null}
                    {item.is_resolved ? <CheckCircle2 className={styles.doneIcon} size={16} aria-label="처리됨" /> : null}
                    <ArrowRight size={15} aria-hidden />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function UpcomingArrivalCard({
  data,
  loading,
  error,
  onNavigate,
}: Pick<ArrivalOperationsBoardProps, "data" | "loading" | "error" | "onNavigate">) {
  const items = data?.items.filter((item) => item.date !== data.today) ?? [];
  const visibleItems = items.slice(0, 8);

  if (!loading && !error && items.length === 0) return null;

  return (
    <section className={styles.upcomingCard} aria-labelledby="upcoming-arrival-title">
      <header>
        <span>이번 주 준비</span>
        <h2 id="upcoming-arrival-title">오늘 이후 일정</h2>
        <strong>{loading ? "…" : error ? "확인 필요" : `${items.length}명`}</strong>
      </header>
      {!loading && !error && items.length > 0 ? (
        <div className={styles.upcomingList}>
          {groupByDate(visibleItems).map(([date, dateItems]) => (
            <div key={date} className={styles.upcomingDay}>
              <strong className={styles.upcomingDayLabel}>
                {SHORT_DATE_FORMATTER.format(localDate(date))}
              </strong>
              {dateItems.map((item) => (
                <button key={item.key} type="button" onClick={() => onNavigate(item)}>
                  <strong>{item.time ?? "미정"}</strong>
                  <span>{item.student_name}</span>
                  <small>{sourceLabel(item.source)}</small>
                </button>
              ))}
            </div>
          ))}
          {items.length > 8 ? <p className={styles.moreCount}>외 {items.length - 8}명</p> : null}
        </div>
      ) : null}
    </section>
  );
}
