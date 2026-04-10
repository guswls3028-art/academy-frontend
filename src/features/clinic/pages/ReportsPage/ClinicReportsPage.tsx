// PATH: src/features/clinic/pages/ReportsPage/ClinicReportsPage.tsx
// 리포트 — 섹션형 SSOT, 월 단위 캘린더 (자세히/간략 전환 제거, 월 표시 우측 중앙)

import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

  function moveMonth(diff: number) {
    const d = dayjs(`${ym.year}-${String(ym.month).padStart(2, "0")}-01`).add(
      diff,
      "month"
    );
    setYm({ year: d.year(), month: d.month() + 1 });
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
    return d.format("M월"); // "3월"
  }, [ym.year, ym.month]);
  const yearLabel = useMemo(() => String(ym.year), [ym.year]);

  return (
    <div className="clinic-page space-y-0">
      {/* 월 네비 — 우측 중앙 배치 */}
      <div className="clinic-reports-calendar-block">
        <div className="clinic-reports-calendar-block__nav">
          <div className="clinic-reports-calendar-block__month-wrap">
            <button
              type="button"
              className="clinic-reports-calendar-block__nav-btn"
              onClick={() => moveMonth(-1)}
              aria-label="이전 달"
            >
              <ChevronLeft size={28} strokeWidth={2} />
            </button>
            <div className="clinic-reports-calendar-block__month">
              <span className="clinic-reports-calendar-block__year">{yearLabel}</span>
              <span className="clinic-reports-calendar-block__month-label">{monthLabel}</span>
            </div>
            <button
              type="button"
              className="clinic-reports-calendar-block__nav-btn"
              onClick={() => moveMonth(1)}
              aria-label="다음 달"
            >
              <ChevronRight size={28} strokeWidth={2} />
            </button>
          </div>
          {sessionsQ.isLoading && (
            <span className="text-xs text-[var(--color-text-muted)]">
              불러오는 중…
            </span>
          )}
          {sessionsQ.isError && (
            <span className="text-xs text-[var(--color-error)]">
              데이터를 불러오지 못했습니다.
            </span>
          )}
        </div>

        {sessionsQ.isError ? (
          <div className="clinic-reports-calendar-block__empty">
            <p className="text-sm text-[var(--color-text-muted)]" style={{ textAlign: "center", padding: "48px 24px" }}>
              클리닉 데이터를 불러오지 못했습니다. 네트워크를 확인한 뒤 새로고침해 주세요.
            </p>
          </div>
        ) : (
        <div className="clinic-reports-calendar-block__grid">
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
                      "bg-[color-mix(in_srgb,var(--color-brand-primary)_6%,var(--color-bg-surface))]"
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
                        className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--color-brand-primary)]"
                        title={`${items.length}개`}
                      />
                    )}
                  </div>
                  {has && (
                    <div className="mt-2 space-y-1">
                      {items.slice(0, 3).map((s) => (
                        <div
                          key={s.id}
                          className="text-[11px] rounded-md px-2 py-1.5 font-medium border border-[color-mix(in_srgb,var(--color-brand-primary)_20%,var(--color-border-divider))] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] flex flex-wrap items-center gap-x-2 gap-y-0"
                        >
                          <span className="font-semibold shrink-0">
                            {startTimeHHMM(s.start_time) || "—"}
                          </span>
                          <span className="text-[var(--color-text-muted)] truncate min-w-0">
                            {s.location?.trim() || "장소 미지정"}
                          </span>
                          <span className="text-[var(--color-text-secondary)] shrink-0">
                            {typeof s.participant_count === "number"
                              ? `${s.participant_count}명`
                              : "0명"}
                          </span>
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
          {!sessionsQ.isLoading && sessions.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--color-text-muted)" }}>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>이 달에는 클리닉 일정이 없습니다.</p>
              <p style={{ fontSize: 13 }}>클리닉 진행 탭에서 일정을 등록해 보세요.</p>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
