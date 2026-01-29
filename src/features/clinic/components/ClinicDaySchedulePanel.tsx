// PATH: src/features/clinic/components/ClinicDaySchedulePanel.tsx
import { ClinicParticipant } from "../api/clinicParticipants.api";

export default function ClinicDaySchedulePanel({
  date,
  rows,
}: {
  date: string;
  rows: ClinicParticipant[];
}) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border bg-[var(--bg-surface)] p-5">
        <div className="text-sm font-semibold">클리닉 일정</div>
        <div className="mt-2 text-xs text-[var(--text-muted)]">
          {date}에 잡힌 클리닉 일정이 없습니다.
        </div>
      </div>
    );
  }

  const byTime = rows.reduce<Record<string, ClinicParticipant[]>>((acc, r) => {
    const t = (r.session_start_time || "").slice(0, 5) || "-";
    acc[t] ??= [];
    acc[t].push(r);
    return acc;
  }, {});

  const times = Object.keys(byTime).sort((a, b) => (a > b ? 1 : -1));

  return (
    <div className="rounded-2xl border bg-[var(--bg-surface)] overflow-hidden">
      <div className="px-5 py-4 border-b bg-[var(--bg-surface-soft)]">
        <div className="text-sm font-semibold">클리닉 일정</div>
      </div>

      <div className="p-5 space-y-4">
        {times.map((time) => {
          const items = byTime[time] ?? [];
          return (
            <div key={time}>
              <div className="text-xs font-semibold mb-1">{time}</div>
              <ul className="space-y-1">
                {items.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-lg border bg-[var(--bg-surface-soft)] px-3 py-2"
                  >
                    <div className="text-sm font-semibold">{r.student_name}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {r.session_location}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
