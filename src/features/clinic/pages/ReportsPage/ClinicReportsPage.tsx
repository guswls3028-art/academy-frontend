// PATH: src/features/clinic/pages/ReportsPage/ClinicReportsPage.tsx

import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type ClinicSession = {
  id: number;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM or HH:MM:SS
  duration_minutes?: number;
  location?: string;
  participant_count?: number;
};

type DayCell = {
  date: string; // YYYY-MM-DD
  isCurrentMonth: boolean;
};

function normalizeList(resData: any): any[] {
  if (Array.isArray(resData)) return resData;
  if (Array.isArray(resData?.results)) return resData.results;
  return [];
}

function startTimeHHMM(v: string) {
  if (!v) return "";
  return v.slice(0, 5);
}

function buildMonthCalendar(year: number, month: number): DayCell[] {
  const first = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
  const startDow = first.day(); // 0=Sun
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

  // compact 모드: "폴더 접기"처럼 날짜 단위 접기/펼치기
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>(
    {}
  );

  function moveMonth(diff: number) {
    const d = dayjs(`${ym.year}-${String(ym.month).padStart(2, "0")}-01`).add(
      diff,
      "month"
    );
    setYm({ year: d.year(), month: d.month() + 1 });
    setCollapsedDays({}); // 달 바뀌면 접기 상태 초기화
  }

  const range = useMemo(() => monthRangeISO(ym.year, ym.month), [ym.year, ym.month]);

  const sessionsQ = useQuery({
    queryKey: ["clinic-sessions-month", range.from, range.to],
    queryFn: async () => {
      const res = await api.get("/clinic/sessions/", {
        params: { date_from: range.from, date_to: range.to, ordering: "date,start_time" },
      });
      const rows = normalizeList(res.data) as any[];
      // 최소 필드만 안전하게 정규화
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
    // 시간순 정렬
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => (startTimeHHMM(a.start_time) > startTimeHHMM(b.start_time) ? 1 : -1));
    });
    return map;
  }, [sessions]);

  const cells = useMemo(() => buildMonthCalendar(ym.year, ym.month), [ym.year, ym.month]);

  const monthLabel = useMemo(() => {
    // "2026 Jan" 형태
    const d = dayjs(`${ym.year}-${String(ym.month).padStart(2, "0")}-01`);
    return `${d.format("YYYY")} ${d.format("MMM")}`;
  }, [ym.year, ym.month]);

  const compactDays = useMemo(() => {
    // 일정 있는 날짜만: 빈 캘린더 영역 자체를 없애버림
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
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <div className="text-xl font-semibold">리포트</div>
        <div className="text-xs text-[var(--text-muted)]">
          월 단위 클리닉 현황 (과거 기록 포함) · 서버 단일진실 기반
        </div>
      </div>

      {/* Control Bar (LEFT ALIGNED — 절대 우측정렬 금지) */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="h-[34px] px-3 rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] text-sm hover:bg-[var(--bg-surface-soft)]"
          onClick={() => moveMonth(-1)}
        >
          ← 이전달
        </button>

        <button
          className="h-[34px] px-3 rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] text-sm hover:bg-[var(--bg-surface-soft)]"
          onClick={() => moveMonth(1)}
        >
          다음달 →
        </button>

        <div className="ml-2 px-2 py-1 rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface-soft)]">
          <div className="text-base font-semibold leading-none">{monthLabel}</div>
        </div>

        <div className="ml-2 flex gap-1">
          <button
            onClick={() => setMode("detail")}
            className={cx(
              "h-[32px] px-3 rounded-lg text-sm border border-[var(--border-divider)]",
              mode === "detail" &&
                "bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]"
            )}
          >
            자세히
          </button>
          <button
            onClick={() => setMode("compact")}
            className={cx(
              "h-[32px] px-3 rounded-lg text-sm border border-[var(--border-divider)]",
              mode === "compact" &&
                "bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]"
            )}
          >
            간략히
          </button>
        </div>

        {mode === "compact" && (
          <div className="flex items-center gap-2">
            <button
              className="h-[32px] px-3 rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] text-sm hover:bg-[var(--bg-surface-soft)]"
              onClick={expandAll}
              disabled={!hasAny}
            >
              모두 펼치기
            </button>
            <button
              className="h-[32px] px-3 rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] text-sm hover:bg-[var(--bg-surface-soft)]"
              onClick={collapseAll}
              disabled={!hasAny}
            >
              모두 접기
            </button>
          </div>
        )}

        {sessionsQ.isLoading && (
          <div className="text-xs text-[var(--text-muted)] ml-2">불러오는 중...</div>
        )}
      </div>

      {/* Content */}
      {mode === "detail" ? (
        // ✅ 자세히: 달력 + 여백 + 시각 강조
        <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[var(--border-divider)] bg-[var(--bg-surface-soft)] text-xs font-semibold">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
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
                    "border-t border-r border-[var(--border-divider)] p-2",
                    !c.isCurrentMonth && "bg-[var(--bg-surface-soft)] opacity-60",
                    has && c.isCurrentMonth && "bg-[color-mix(in_srgb,var(--color-primary)_6%,var(--bg-surface))]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className={cx("text-xs font-semibold", has && "text-[var(--text-primary)]")}>
                      {c.date.slice(8)}
                    </div>

                    {has && (
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{ background: "var(--color-primary)" }}
                        title={`${items.length}개 일정`}
                      />
                    )}
                  </div>

                  {has && (
                    <div className="mt-2 space-y-1">
                      {items.slice(0, 3).map((s) => (
                        <div
                          key={s.id}
                          className={cx(
                            "text-[11px] rounded-md px-2 py-1 font-semibold",
                            "border border-[color-mix(in_srgb,var(--color-primary)_20%,var(--border-divider))]",
                            "bg-[var(--bg-surface)]"
                          )}
                        >
                          {startTimeHHMM(s.start_time)} · 클리닉
                          {s.location ? (
                            <span className="ml-1 text-[var(--text-muted)] font-medium">
                              · {s.location}
                            </span>
                          ) : null}
                        </div>
                      ))}

                      {items.length > 3 && (
                        <div className="text-[11px] text-[var(--text-muted)]">
                          + {items.length - 3}개 더 있음
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-5 py-3 text-[11px] text-[var(--text-muted)] border-t border-[var(--border-divider)]">
            * 데이터: /clinic/sessions/?date_from={range.from}&date_to={range.to}
          </div>
        </div>
      ) : (
        // ✅ 간략히: “달력 영역 자체 제거” + 일정 있는 날만 폴더식 리스트
        <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-divider)] bg-[var(--bg-surface-soft)]">
            <div className="text-sm font-semibold">월간 일정 (간략)</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              일정 있는 날짜만 표시 · 빈 날짜 영역은 접혀서 사라집니다.
            </div>
          </div>

          <div className="p-4">
            {!sessionsQ.isLoading && !hasAny && (
              <div className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-4 text-sm text-[var(--text-muted)]">
                이번 달에 잡힌 클리닉 일정이 없습니다.
              </div>
            )}

            <div className="space-y-2">
              {compactDays.map((d) => {
                const collapsed = !!collapsedDays[d.date];
                const count = d.items.length;

                return (
                  <div
                    key={d.date}
                    className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] overflow-hidden"
                  >
                    {/* 폴더 헤더 */}
                    <button
                      type="button"
                      onClick={() => toggleDay(d.date)}
                      className={cx(
                        "w-full px-4 py-3 flex items-center justify-between text-left",
                        "bg-[var(--bg-surface-soft)] hover:bg-[var(--bg-surface)]"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ background: "var(--color-primary)" }}
                        />
                        <div className="text-sm font-semibold">
                          {d.date} <span className="text-[var(--text-muted)] font-medium">({d.dow})</span>
                        </div>
                        <div className="text-xs text-[var(--text-muted)] ml-2">
                          {count}개
                        </div>
                      </div>

                      <div className="text-sm text-[var(--text-muted)]">
                        {collapsed ? "▶" : "▼"}
                      </div>
                    </button>

                    {/* 폴더 내용 */}
                    {!collapsed && (
                      <div className="px-4 py-3 space-y-2">
                        {d.items.map((s) => (
                          <div
                            key={s.id}
                            className={cx(
                              "rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3",
                              "flex items-center justify-between gap-3"
                            )}
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold">
                                {startTimeHHMM(s.start_time)} · 클리닉
                              </div>
                              <div className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                                {s.location ? s.location : "장소 미지정"}
                              </div>
                            </div>

                            <div className="shrink-0 text-xs font-semibold">
                              {typeof s.participant_count === "number" ? `${s.participant_count}명` : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-[11px] text-[var(--text-muted)] mt-3">
              * 데이터: /clinic/sessions/?date_from={range.from}&date_to={range.to}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
