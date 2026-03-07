// PATH: src/features/clinic/pages/ReportsPage/ClinicReportsPage.tsx
// 리포트 — 섹션형 SSOT, 월 단위·자세히/간략 전환

import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type ClinicSession = {
  id: number;
  date: string;
  start_time: string;
  duration_minutes?: number;
  location?: string;
  participant_count?: number;
};

type DayCell = { date: string; isCurrentMonth: boolean };

function normalizeList(resData: any): any[] {
  if (Array.isArray(resData)) return resData;
  if (Array.isArray(resData?.results)) return resData.results;
  return [];
}

function startTimeHHMM(v: string) {
  return v ? v.slice(0, 5) : "";
}

function buildMonthCalendar(year: number, month: number): DayCell[] {
  const first = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
  const startDow = first.day();
  const start = first.subtract(startDow, "day");
  return Array.from({ length: 42 }, (_, i) => {
    const d = start.add(i, "day");
    return {
      date: d.format("YYYY-MM-DD"),
      isCurrentMonth: d.month() + 1 === month,
    };
  });
}

function monthRangeISO(year: number, month: number) {
  const first = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
  return {
    from: first.startOf("month").format("YYYY-MM-DD"),
    to: first.endOf("month").format("YYYY-MM-DD"),
  };
}

export default function ClinicReportsPage() {
  const today = dayjs();
  const [ym, setYm] = useState(() => ({
    year: today.year(),
    month: today.month() + 1,
  }));
  const [mode, setMode] = useState<"detail" | "compact">("detail");
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});

  function moveMonth(diff: number) {
    const d = dayjs(`${ym.year}-${String(ym.month).padStart(2, "0")}-01`).add(
      diff,
      "month"
    );
    setYm({ year: d.year(), month: d.month() + 1 });
    setCollapsedDays({});
  }

  const range = useMemo(
    () => monthRangeISO(ym.year, ym.month),
    [ym.year, ym.month]
  );

  const sessionsQ = useQuery({
    queryKey: ["clinic-sessions-month", range.from, range.to],
    queryFn: async () => {
      const res = await api.get("/clinic/sessions/", {
        params: {
          date_from: range.from,
          date_to: range.to,
          ordering: "date,start_time",
        },
      });
      const rows = normalizeList(res.data) as any[];
      return rows.map((r: any) => ({
        id: Number(r.id),
        date: String(r.date),
        start_time: String(r.start_time ?? ""),
        duration_minutes:
          r.duration_minutes == null ? undefined : Number(r.duration_minutes),
        location: r.location == null ? undefined : String(r.location),
        participant_count:
          r.participant_count == null ? undefined : Number(r.participant_count),
      })) as ClinicSession[];
    },
    staleTime: 10_000,
    retry: 0,
  });

  const sessions = sessionsQ.data ?? [];
  const sessionsByDate = useMemo(() => {
    const map: Record<string, ClinicSession[]> = {};
    sessions.forEach((s) => {
      map[s.date] ??= [];
      map[s.date].push(s);
    });
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) =>
        startTimeHHMM(a.start_time) > startTimeHHMM(b.start_time) ? 1 : -1
      );
    });
    return map;
  }, [sessions]);

  const cells = useMemo(
    () => buildMonthCalendar(ym.year, ym.month),
    [ym.year, ym.month]
  );
  const monthLabel = useMemo(() => {
    const d = dayjs(
      `${ym.year}-${String(ym.month).padStart(2, "0")}-01`
    );
    return `${d.format("YYYY")} ${d.format("MMM")}`;
  }, [ym.year, ym.month]);

  const compactDays = useMemo(() => {
    const keys = Object.keys(sessionsByDate).sort((a, b) => (a > b ? 1 : -1));
    return keys.map((date) => ({
      date,
      dow: dayjs(date).format("dd"),
      items: sessionsByDate[date] ?? [],
    }));
  }, [sessionsByDate]);

  const hasAny = sessions.length > 0;
  const toggleDay = (date: string) => {
    setCollapsedDays((prev) => ({ ...prev, [date]: !prev[date] }));
  };
  const expandAll = () => {
    const next: Record<string, boolean> = {};
    compactDays.forEach((d) => (next[d.date] = false));
    setCollapsedDays(next);
  };
  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    compactDays.forEach((d) => (next[d.date] = true));
    setCollapsedDays(next);
  };

  return (
    <div className="clinic-page">
      <section className="ds-section clinic-panel">
        <div className="clinic-panel__header flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="clinic-panel__title">리포트</h2>
            <p className="clinic-panel__meta">월 단위 클리닉 현황</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="h-9 px-3 rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)]"
              onClick={() => moveMonth(-1)}
            >
              ← 이전
            </button>
            <button
              type="button"
              className="h-9 px-3 rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)]"
              onClick={() => moveMonth(1)}
            >
              다음 →
            </button>
            <div className="px-3 py-1.5 rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] text-sm font-semibold text-[var(--color-text-primary)]">
              {monthLabel}
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setMode("detail")}
                className={cx(
                  "h-8 px-3 rounded-lg text-sm font-medium border",
                  mode === "detail"
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-text-inverse)]"
                    : "border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface-hover)]"
                )}
              >
                자세히
              </button>
              <button
                type="button"
                onClick={() => setMode("compact")}
                className={cx(
                  "h-8 px-3 rounded-lg text-sm font-medium border",
                  mode === "compact"
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-text-inverse)]"
                    : "border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface-hover)]"
                )}
              >
                간략
              </button>
            </div>
            {mode === "compact" && (
              <>
                <button
                  type="button"
                  className="h-8 px-3 rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)] disabled:opacity-50"
                  onClick={expandAll}
                  disabled={!hasAny}
                >
                  모두 펼침
                </button>
                <button
                  type="button"
                  className="h-8 px-3 rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)] disabled:opacity-50"
                  onClick={collapseAll}
                  disabled={!hasAny}
                >
                  모두 접기
                </button>
              </>
            )}
            {sessionsQ.isLoading && (
              <span className="text-xs text-[var(--color-text-muted)]">
                불러오는 중…
              </span>
            )}
          </div>
        </div>
      </section>

      {mode === "detail" ? (
        <div className="clinic-panel overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] text-xs font-semibold text-[var(--color-text-primary)]">
            {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
              <div key={d} className="px-3 py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-[132px]">
            {cells.map((c) => {
              const items = sessionsByDate[c.date] ?? [];
              const has = items.length > 0;
              return (
                <div
                  key={c.date}
                  className={cx(
                    "border-t border-r border-[var(--color-border-divider)] p-2",
                    !c.isCurrentMonth && "bg-[var(--color-bg-surface-soft)] opacity-60",
                    has &&
                      c.isCurrentMonth &&
                      "bg-[color-mix(in_srgb,var(--color-primary)_6%,var(--color-bg-surface))]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cx(
                        "text-xs font-semibold",
                        has && "text-[var(--color-text-primary)]"
                      )}
                    >
                      {c.date.slice(8)}
                    </span>
                    {has && (
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]"
                        title={`${items.length}개`}
                      />
                    )}
                  </div>
                  {has && (
                    <div className="mt-2 space-y-1">
                      {items.slice(0, 3).map((s) => (
                        <div
                          key={s.id}
                          className="text-[11px] rounded-md px-2 py-1 font-semibold border border-[color-mix(in_srgb,var(--color-primary)_20%,var(--color-border-divider))] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]"
                        >
                          {startTimeHHMM(s.start_time)}
                          {s.location ? (
                            <span className="ml-1 text-[var(--color-text-muted)] font-medium">
                              · {s.location}
                            </span>
                          ) : null}
                        </div>
                      ))}
                      {items.length > 3 && (
                        <p className="text-[11px] text-[var(--color-text-muted)]">
                          +{items.length - 3}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="clinic-panel overflow-hidden">
          <div className="clinic-panel__header">
            <h2 className="clinic-panel__title">월간 일정 (간략)</h2>
            <p className="clinic-panel__meta">일정 있는 날만 표시</p>
          </div>
          <div className="clinic-panel__body space-y-2">
            {!sessionsQ.isLoading && !hasAny && (
              <p className="ds-section__empty">이번 달 클리닉 일정이 없습니다.</p>
            )}
            {compactDays.map((d) => {
              const collapsed = !!collapsedDays[d.date];
              const count = d.items.length;
              return (
                <div
                  key={d.date}
                  className="rounded-xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleDay(d.date)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left bg-[var(--color-bg-surface-soft)] hover:bg-[var(--color-bg-surface-hover)] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]" />
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {d.date}{" "}
                        <span className="text-[var(--color-text-muted)] font-medium">
                          ({d.dow})
                        </span>
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {count}개
                      </span>
                    </div>
                    <span className="text-sm text-[var(--color-text-muted)]">
                      {collapsed ? "▶" : "▼"}
                    </span>
                  </button>
                  {!collapsed && (
                    <div className="px-4 py-3 space-y-2 border-t border-[var(--color-border-divider)]">
                      {d.items.map((s) => (
                        <div
                          key={s.id}
                          className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-3 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                              {startTimeHHMM(s.start_time)}
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                              {s.location || "장소 미지정"}
                            </div>
                          </div>
                          <span className="shrink-0 text-xs font-semibold text-[var(--color-text-primary)]">
                            {typeof s.participant_count === "number"
                              ? `${s.participant_count}명`
                              : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
