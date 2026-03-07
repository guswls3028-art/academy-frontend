// PATH: src/features/clinic/pages/HomePage/ClinicHomePage.tsx
// 클리닉 홈 — 섹션형 SSOT, 시각 위계(숫자·CTA 우선)

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { DatePicker } from "@/shared/ui/date";
import { Button, KPI } from "@/shared/ui/ds";
import { useClinicParticipants } from "../../hooks/useClinicParticipants";
import { useClinicTargets } from "../../hooks/useClinicTargets";
import ClinicTodaySummary from "../../components/home/ClinicTodaySummary";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function weekRangeISO(base: string) {
  const d = dayjs(base);
  const start = d.startOf("week").add(1, "day");
  const end = start.add(6, "day");
  return { from: start.format("YYYY-MM-DD"), to: end.format("YYYY-MM-DD") };
}

export default function ClinicHomePage() {
  const nav = useNavigate();
  const [date, setDate] = useState(todayISO());
  const wk = useMemo(() => weekRangeISO(date), [date]);

  const todayQ = useClinicParticipants({
    session_date_from: date,
    session_date_to: date,
  });
  const weekQ = useClinicParticipants({
    session_date_from: wk.from,
    session_date_to: wk.to,
  });
  const targetsQ = useClinicTargets();

  const bookedEnrollmentIds = useMemo(() => {
    const set = new Set<number>();
    (weekQ.listQ.data ?? []).forEach((p) => {
      if (!p.enrollment_id || p.status === "cancelled") return;
      set.add(p.enrollment_id);
    });
    return set;
  }, [weekQ.listQ.data]);

  const requiredCount = useMemo(() => {
    const targets = targetsQ.data ?? [];
    return targets.filter((t) => !bookedEnrollmentIds.has(t.enrollment_id)).length;
  }, [targetsQ.data, bookedEnrollmentIds]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = dayjs(wk.from).add(i, "day");
      return { date: d.format("YYYY-MM-DD"), dow: d.format("dd") };
    });
  }, [wk.from]);

  const rowsByDay = useMemo(() => {
    const map: Record<string, { total: number; byTime: Record<string, number> }> = {};
    weekDays.forEach((d) => {
      map[d.date] = { total: 0, byTime: {} };
    });
    (weekQ.listQ.data ?? []).forEach((r) => {
      const key = r.session_date;
      if (!map[key]) return;
      const t = (r.session_start_time || "").slice(0, 5);
      map[key].byTime[t] = (map[key].byTime[t] ?? 0) + 1;
      map[key].total += 1;
    });
    return map;
  }, [weekQ.listQ.data, weekDays]);

  return (
    <div className="clinic-page">
      <div className="clinic-toolbar">
        <DatePicker value={date} onChange={setDate} placeholder="날짜" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ClinicTodaySummary
          date={date}
          rows={todayQ.listQ.data ?? []}
          loading={todayQ.listQ.isLoading}
          onGoOperations={() => nav("/admin/clinic/operations")}
          onGoBookings={() => nav("/admin/clinic/bookings")}
        />

        <section className="ds-section clinic-panel">
          <div className="clinic-panel__header">
            <h2 className="clinic-panel__title">예약 필수</h2>
            <p className="clinic-panel__meta">이번 주 미예약</p>
          </div>
          <div className="clinic-panel__body flex items-end justify-between gap-4">
            <KPI
              label=""
              value={requiredCount}
              hint={requiredCount > 0 ? "확인 필요" : undefined}
            />
            <Button
              type="button"
              intent="primary"
              size="sm"
              onClick={() => nav("/admin/clinic/bookings?focus=required")}
            >
              관리
            </Button>
          </div>
        </section>

        <section className="ds-section clinic-panel">
          <div className="clinic-panel__header">
            <h2 className="clinic-panel__title">예약 신청</h2>
          </div>
          <div className="clinic-panel__body">
            <p className="text-sm text-[var(--color-text-muted)]">현재 없음</p>
          </div>
        </section>
      </div>

      <section className="ds-section clinic-panel">
        <div className="clinic-panel__header">
          <h2 className="clinic-panel__title">주간 일정</h2>
          <p className="clinic-panel__meta">
            {wk.from} ~ {wk.to}
          </p>
        </div>
        <div className="clinic-panel__body">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
            {weekDays.map((d) => {
              const info = rowsByDay[d.date];
              const times = Object.keys(info.byTime).sort();
              const isToday = d.date === date;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => {
                    setDate(d.date);
                    nav(`/admin/clinic/operations?date=${d.date}`);
                  }}
                  className={`clinic-day-cell block w-full text-left ${isToday ? "clinic-day-cell--today" : ""}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-lg font-semibold ${isToday ? "text-[var(--color-brand-primary)]" : "text-[var(--color-text-primary)]"}`}
                    >
                      {d.dow}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {times.length}회 · {info.total}명
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {times.map((t) => (
                      <div
                        key={t}
                        className="clinic-time-block text-sm font-medium"
                      >
                        {t} 시작 · {info.byTime[t]}명
                      </div>
                    ))}
                    {times.length === 0 && (
                      <p className="text-sm text-[var(--color-text-muted)]">
                        일정 없음
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
