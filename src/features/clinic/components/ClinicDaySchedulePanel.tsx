// PATH: src/features/clinic/components/ClinicDaySchedulePanel.tsx
// 당일 클리닉 일정 — 섹션형 SSOT

import { ClinicParticipant } from "../api/clinicParticipants.api";

function EmptyCalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export default function ClinicDaySchedulePanel({
  date,
  rows,
}: {
  date: string;
  rows: ClinicParticipant[];
}) {
  if (!rows.length) {
    return (
      <div className="clinic-panel overflow-hidden">
        <div className="clinic-panel__header">
          <h2 className="clinic-panel__title">클리닉 일정</h2>
          <p className="clinic-panel__meta">{date}</p>
        </div>
        <div className="clinic-panel__body">
          <div className="clinic-empty-state">
            <EmptyCalendarIcon className="clinic-empty-state__icon" />
            <p className="clinic-empty-state__text">해당 날짜에 일정이 없습니다.</p>
          </div>
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
      <div className="clinic-panel__body space-y-5">
        {times.map((time) => {
          const items = byTime[time] ?? [];
          return (
            <section key={time} className="clinic-section">
              <div className="clinic-section__header">
                <p className="clinic-section__title">{time}</p>
              </div>
              <ul className="space-y-2">
                {items.map((r) => (
                  <li
                    key={r.id}
                    className="ds-section__item rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-3 cursor-default"
                  >
                    <div className="ds-section__item-label">{r.student_name}</div>
                    {r.session_location && (
                      <div className="ds-section__item-meta">{r.session_location}</div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
