import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DatePicker } from "antd";
import dayjs, { Dayjs } from "dayjs";

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
    <div className="flex flex-col gap-[var(--space-6)]">
        {/* 툴바: 날짜 선택 (도메인 타이틀은 Layout에서) */}
        <div className="flex items-center justify-end">
          <DatePicker
            value={dayjs(date)}
            onChange={(d: Dayjs | null) => d && setDate(d.format("YYYY-MM-DD"))}
            allowClear={false}
            size="large"
            style={{ width: 200 }}
          />
        </div>

        {/* 상단 3열: 오늘 클리닉 · 예약 필수 · 예약 신청 */}
        <div className="grid grid-cols-1 gap-[var(--space-6)] lg:grid-cols-3">
          <ClinicTodaySummary
            date={date}
            rows={todayQ.listQ.data ?? []}
            loading={todayQ.listQ.isLoading}
            onGoOperations={() => nav("/admin/clinic/operations")}
            onGoBookings={() => nav("/admin/clinic/bookings")}
          />

          <div className="ds-panel" data-panel-variant="default">
            <div className="clinic-card__header">
              <div
                style={{
                  fontSize: "var(--text-md)",
                  color: "var(--color-text-primary)",
                  fontWeight: "var(--font-title)",
                }}
              >
                예약 필수 대상자
              </div>
              <div
                className="mt-1"
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-muted)",
                  fontWeight: "var(--font-meta)",
                }}
              >
                이번 주 미예약
              </div>
            </div>
            <div className="clinic-card__body flex items-end justify-between">
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
                관리 이동
              </Button>
            </div>
          </div>

          <div className="ds-panel" data-panel-variant="subtle">
            <div className="clinic-card__header">
              <div
                style={{
                  fontSize: "var(--text-md)",
                  color: "var(--color-text-primary)",
                  fontWeight: "var(--font-title)",
                }}
              >
                예약 신청자
              </div>
            </div>
            <div className="clinic-card__body">
              <div
                style={{
                  fontSize: "var(--text-md)",
                  color: "var(--color-text-muted)",
                  fontWeight: "var(--font-meta)",
                }}
              >
                현재 없음
              </div>
            </div>
          </div>
        </div>

        {/* 주간 일정 */}
        <div className="ds-panel" data-panel-variant="default">
          <div className="clinic-card__header">
            <div
              style={{
                fontSize: "var(--text-lg)",
                fontWeight: "var(--font-title)",
                color: "var(--color-text-primary)",
              }}
            >
              주간 일정
            </div>
            <div
              className="mt-1"
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-muted)",
                fontWeight: "var(--font-meta)",
              }}
            >
              {wk.from} ~ {wk.to}
            </div>
          </div>
          <div
            className="grid grid-cols-1 gap-[var(--space-4)] md:grid-cols-7"
            style={{ padding: "var(--space-6)" }}
          >
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
                  className="clinic-day-cell !block !w-full !text-left !justify-start"
                  style={{
                    borderColor: isToday ? "var(--color-primary)" : undefined,
                    borderWidth: isToday ? 2 : 1,
                    background: isToday
                      ? "color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-surface))"
                      : undefined,
                  }}
                >
                  <div
                    className="flex items-center justify-between"
                    style={{ marginBottom: "var(--space-3)" }}
                  >
                    <div
                      style={{
                        fontSize: "var(--text-lg)",
                        fontWeight: "var(--font-title)",
                        color: isToday
                          ? "var(--color-primary)"
                          : "var(--color-text-primary)",
                      }}
                    >
                      {d.dow}
                    </div>
                    <div
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--color-text-muted)",
                        fontWeight: "var(--font-meta)",
                      }}
                    >
                      {times.length}회 · {info.total}명
                    </div>
                  </div>
                  <div
                    className="flex flex-col"
                    style={{ gap: "var(--space-2)" }}
                  >
                    {times.map((t) => (
                      <div
                        key={t}
                        className="clinic-kpi-block text-sm font-medium"
                        style={{
                          color: "var(--color-text-primary)",
                          fontWeight: "var(--font-meta)",
                        }}
                      >
                        {t} 시작 · {info.byTime[t]}명
                      </div>
                    ))}
                    {times.length === 0 && (
                      <div
                        style={{
                          fontSize: "var(--text-sm)",
                          color: "var(--color-text-muted)",
                        }}
                      >
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
