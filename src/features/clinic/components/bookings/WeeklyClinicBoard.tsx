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
      return Array.isArray(res.data?.results)
        ? res.data.results
        : res.data;
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
      message.warning("좌측에서 대상자를 먼저 선택하세요.");
      return;
    }
    try {
      for (const eid of selectedEnrollmentIds) {
        await addParticipantM.mutateAsync({
          session: sessionId,
          enrollment_id: eid,
        });
      }
      message.success("기존 클리닉에 추가했습니다.");
    } catch {
      message.error("추가 중 오류가 발생했습니다.");
    }
  }

  const sessions: ClinicSession[] = sessionsQ.data ?? [];

  return (
    <div className="rounded-2xl border bg-[var(--bg-surface)] overflow-hidden">
      <div className="px-5 py-4 border-b bg-[var(--bg-surface-soft)]">
        <div className="text-sm font-semibold">이번 주 클리닉</div>
        <div className="text-xs text-[var(--text-muted)]">
          오늘 기준 · 이전 요일은 다음주로 표시
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-[var(--border-divider)]">
        {days.map(({ date, isNextWeek }) => {
          const daySessions = sessions.filter((s) => s.date === date);

          return (
            <div
              key={date}
              className={[
                "min-h-[180px] p-2",
                isNextWeek
                  ? "bg-[var(--bg-surface-soft)]"
                  : "bg-[var(--bg-surface)]",
              ].join(" ")}
            >
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold">
                    {dayjs(date).format("dd")}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
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
                <div className="text-[11px] text-[var(--text-muted)]">
                  일정 없음
                </div>
              )}

              <div className="space-y-1">
                {daySessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => addToSession(s.id)}
                    className="
                      w-full rounded-lg border border-[var(--border-divider)]
                      px-2 py-1 text-left text-xs
                      hover:bg-[var(--bg-surface-soft)]
                    "
                  >
                    <div className="font-semibold">
                      {s.start_time.slice(0, 5)}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {s.location} · {s.participant_count}명
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3 text-[11px] text-[var(--text-muted)]">
        * 연한 배경은 다음 주 일정입니다.
      </div>
    </div>
  );
}
