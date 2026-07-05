// PATH: src/app_admin/domains/clinic/pages/ReportsPage/ClinicReportsPage.tsx
// 리포트 — 섹션형 SSOT, 월 단위 캘린더 (자세히/간략 전환 제거, 월 표시 우측 중앙)

import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { hhmmText } from "@/shared/ui/time/timeFormat";
import { cx } from "@/shared/utils/cx";
import { fetchClinicSessions, type ClinicSessionDetail } from "../../api/clinicSessions.api";
import { clinicQueryKeys } from "../../queryKeys";

type ClinicSession = {
  id: number;
  date: string;
  start_time: string;
  duration_minutes?: number;
  location?: string;
  participant_count?: number;
};

type DayCell = { date: string; isCurrentMonth: boolean };

function toReportSession(row: ClinicSessionDetail): ClinicSession {
  return {
    id: row.id,
    date: row.date,
    start_time: row.start_time ?? "",
    duration_minutes: row.duration_minutes,
    location: row.location || undefined,
    participant_count: row.participant_count,
  };
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
    queryKey: clinicQueryKeys.sessionsMonthRange(range.from, range.to),
    queryFn: async () => {
      const rows = await fetchClinicSessions({
        date_from: range.from,
        date_to: range.to,
        ordering: "date,start_time",
      });
      return rows.map(toReportSession);
    },
    staleTime: 10_000,
    retry: 0,
  });

  const sessions = useMemo(() => sessionsQ.data ?? [], [sessionsQ.data]);
  const sessionsByDate = useMemo(() => {
    const map: Record<string, ClinicSession[]> = {};
    sessions.forEach((s) => {
      map[s.date] ??= [];
      map[s.date].push(s);
    });
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) =>
        hhmmText(a.start_time) > hhmmText(b.start_time) ? 1 : -1
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
            <p className="clinic-reports-calendar-block__error-message text-sm text-[var(--color-text-muted)]">
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
                            {hhmmText(s.start_time, "—")}
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
            <div className="clinic-reports-calendar-block__empty-month">
              <p className="clinic-reports-calendar-block__empty-title">이 달에는 클리닉 일정이 없습니다.</p>
              <p className="clinic-reports-calendar-block__empty-desc">클리닉 진행 탭에서 일정을 등록해 보세요.</p>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
