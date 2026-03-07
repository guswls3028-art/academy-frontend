// PATH: src/features/clinic/components/ClinicDaySchedulePanel.tsx
// 당일 클리닉 일정 — 섹션형 SSOT

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
      <div className="clinic-panel">
        <div className="clinic-panel__header">
          <h2 className="clinic-panel__title">클리닉 일정</h2>
          <p className="clinic-panel__meta">{date}</p>
        </div>
        <div className="clinic-panel__body">
          <p className="ds-section__empty">해당 날짜에 일정이 없습니다.</p>
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
    <div className="clinic-panel overflow-hidden">
      <div className="clinic-panel__header">
        <h2 className="clinic-panel__title">클리닉 일정</h2>
        <p className="clinic-panel__meta">{date}</p>
      </div>
      <div className="clinic-panel__body space-y-4">
        {times.map((time) => {
          const items = byTime[time] ?? [];
          return (
            <div key={time}>
              <p className="ds-section__kpi-label mb-1">{time}</p>
              <ul className="space-y-1">
                {items.map((r) => (
                  <li
                    key={r.id}
                    className="ds-section__item rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-3 py-2 cursor-default"
                  >
                    <div className="ds-section__item-label">{r.student_name}</div>
                    {r.session_location && (
                      <div className="ds-section__item-meta">{r.session_location}</div>
                    )}
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
