// PATH: src/features/clinic/components/bookings/WeeklyClinicBoard.tsx
// 이번 주 클리닉 보드 — 섹션형 SSOT

import dayjs from "dayjs";
import { Tag, message } from "antd";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";

type ClinicSession = {
  id: number;
  date: string;
  start_time: string;
  location: string;
  participant_count: number;
};

function buildMixedWeek(todayISO: string) {
  const today = dayjs(todayISO);
  const raw = today.day();
  const todayDow = raw === 0 ? 7 : raw;
  return Array.from({ length: 7 }, (_, i) => {
    const dow = i + 1;
    let diff = dow - todayDow;
    if (diff < 0) diff += 7;
    const date = today.add(diff, "day");
    return {
      date: date.format("YYYY-MM-DD"),
      isNextWeek: diff > 0 && dow < todayDow,
    };
  });
}

export default function WeeklyClinicBoard({
  baseDate,
  selectedEnrollmentIds,
}: {
  baseDate: string;
  selectedEnrollmentIds: number[];
}) {
  const qc = useQueryClient();
  const days = useMemo(() => buildMixedWeek(baseDate), [baseDate]);
  const dateFrom = days[0].date;
  const dateTo = days[6].date;

  const sessionsQ = useQuery({
    queryKey: ["clinic-sessions-week-mixed", dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get("/clinic/sessions/", {
        params: { date_from: dateFrom, date_to: dateTo },
      });
      return Array.isArray(res.data?.results) ? res.data.results : res.data;
    },
  });

  const addParticipantM = useMutation({
    mutationFn: async (payload: {
      session: number;
      enrollment_id: number;
    }) =>
      api.post("/clinic/participants/", {
        session: payload.session,
        enrollment_id: payload.enrollment_id,
        source: "manual",
        status: "booked",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-participants"] });
      qc.invalidateQueries({ queryKey: ["clinic-sessions-week-mixed"] });
    },
  });

  async function addToSession(sessionId: number) {
    if (selectedEnrollmentIds.length === 0) {
      message.warning("대상자를 먼저 선택하세요.");
      return;
    }
    try {
      for (const eid of selectedEnrollmentIds) {
        await addParticipantM.mutateAsync({ session: sessionId, enrollment_id: eid });
      }
      message.success("추가했습니다.");
    } catch {
      message.error("추가 중 오류가 발생했습니다.");
    }
  }

  const sessions: ClinicSession[] = sessionsQ.data ?? [];

  return (
    <div className="clinic-panel overflow-hidden">
      <div className="clinic-panel__header">
        <h2 className="clinic-panel__title">이번 주 클리닉</h2>
        <p className="clinic-panel__meta">오늘 기준 · 연한 칸 = 다음 주</p>
      </div>
      <div className="clinic-panel__body p-0">
        <div className="grid grid-cols-7 gap-px bg-[var(--color-border-divider)]">
          {days.map(({ date, isNextWeek }) => {
            const daySessions = sessions.filter((s) => s.date === date);
            return (
              <div
                key={date}
                className={`min-h-[180px] p-2 ${
                  isNextWeek
                    ? "bg-[var(--color-bg-surface-soft)]"
                    : "bg-[var(--color-bg-surface)]"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                      {dayjs(date).format("dd")}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-muted)]">
                      {date.slice(5)}
                    </div>
                  </div>
                  {isNextWeek && (
                    <Tag color="blue" className="text-[10px]">
                      다음주
                    </Tag>
                  )}
                </div>
                {daySessions.length === 0 && (
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    일정 없음
                  </p>
                )}
                <div className="space-y-1">
                  {daySessions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => addToSession(s.id)}
                      className="w-full rounded-lg border border-[var(--color-border-divider)] px-2 py-1.5 text-left text-xs hover:bg-[var(--color-bg-surface-hover)] transition-colors"
                    >
                      <div className="font-semibold text-[var(--color-text-primary)]">
                        {s.start_time.slice(0, 5)}
                      </div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">
                        {s.location} · {s.participant_count}명
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
