import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DatePicker } from "antd";
import dayjs, { Dayjs } from "dayjs";

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
      if (!p.enrollment_id) return;
      if (p.status === "cancelled") return;
      set.add(p.enrollment_id);
    });
    return set;
  }, [weekQ.listQ.data]);

  const requiredCount = useMemo(() => {
    const targets = targetsQ.data ?? [];
    return targets.filter((t) => !bookedEnrollmentIds.has(t.enrollment_id))
      .length;
  }, [targetsQ.data, bookedEnrollmentIds]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = dayjs(wk.from).add(i, "day");
      return { date: d.format("YYYY-MM-DD"), dow: d.format("dd") };
    });
  }, [wk.from]);

  const rowsByDay = useMemo(() => {
    const map: Record<string, { total: number; byTime: Record<string, number> }> =
      {};
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-semibold">클리닉</div>
          <div className="text-sm text-[var(--text-muted)] mt-1">
            오늘 기준 운영 요약
          </div>
        </div>

        <DatePicker
          value={dayjs(date)}
          onChange={(d: Dayjs | null) => d && setDate(d.format("YYYY-MM-DD"))}
          allowClear={false}
        />
      </div>

      {/* 상단 3열 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ClinicTodaySummary
          date={date}
          rows={todayQ.listQ.data ?? []}
          loading={todayQ.listQ.isLoading}
          onGoOperations={() => nav("/admin/clinic/operations")}
          onGoBookings={() => nav("/admin/clinic/bookings")}
        />

        {/* 예약 필수 */}
        <div className="rounded-2xl border bg-[var(--bg-surface)] overflow-hidden">
          <div className="px-5 py-4 border-b bg-[var(--bg-surface-soft)]">
            <div className="text-base font-semibold">예약 필수 대상자</div>
            <div className="text-sm text-[var(--text-muted)] mt-1">
              이번 주 미예약
            </div>
          </div>

          <div className="px-5 py-6 flex items-end justify-between">
            <div className="text-4xl font-bold text-[var(--color-danger)]">
              {requiredCount}명
            </div>
            <button
              className="text-sm font-medium underline text-[var(--color-danger)]"
              onClick={() => nav("/admin/clinic/bookings?focus=required")}
            >
              관리 이동
            </button>
          </div>
        </div>

        {/* 예약 신청 */}
        <div className="rounded-2xl border bg-[var(--bg-surface)] overflow-hidden">
          <div className="px-5 py-4 border-b bg-[var(--bg-surface-soft)]">
            <div className="text-base font-semibold">예약 신청자</div>
          </div>
          <div className="px-5 py-6 text-base text-[var(--text-muted)]">
            현재 없음
          </div>
        </div>
      </div>

      {/* 주간 일정 */}
      <div className="rounded-2xl border bg-[var(--bg-surface)] overflow-hidden">
        <div className="px-5 py-4 border-b bg-[var(--bg-surface-soft)]">
          <div className="text-lg font-semibold">주간 일정</div>
          <div className="text-sm text-[var(--text-muted)] mt-1">
            {wk.from} ~ {wk.to}
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 gap-4 md:grid-cols-7">
          {weekDays.map((d) => {
            const info = rowsByDay[d.date];
            const times = Object.keys(info.byTime).sort();

            return (
              <button
                key={d.date}
                onClick={() => {
                  setDate(d.date);
                  nav(`/admin/clinic/operations?date=${d.date}`);
                }}
                className="rounded-xl border bg-[var(--bg-surface-soft)] p-4 text-left hover:bg-[var(--bg-surface)] transition"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="text-lg font-semibold">{d.dow}</div>
                  <div className="text-sm text-[var(--text-muted)]">
                    {times.length}회 · {info.total}명
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {times.map((t) => (
                    <div
                      key={t}
                      className="rounded-lg border bg-[var(--bg-surface)] px-3 py-2 text-sm font-medium"
                    >
                      {t} 시작 · {info.byTime[t]}명
                    </div>
                  ))}

                  {times.length === 0 && (
                    <div className="text-sm text-[var(--text-muted)]">
                      일정 없음
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
