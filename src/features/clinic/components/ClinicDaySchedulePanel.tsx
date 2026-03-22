// PATH: src/features/clinic/components/ClinicDaySchedulePanel.tsx
// 당일 클리닉 일정 — 섹션형 SSOT (세션 + 참가자), 세션별 상태 색상(🟢🟡🔴)

import { Trash2 } from "lucide-react";
import type { ClinicSessionTreeNode } from "../api/clinicSessions.api";
import { ClinicParticipant } from "../api/clinicParticipants.api";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";

function formatTime(s: string | undefined) {
  if (!s) return "—";
  const part = s.slice(0, 5);
  return part || "—";
}

/** 세션 상태: 정상 | 예약 거의 찼음 | 마감 */
type SlotStatus = "normal" | "almost" | "full";

function getSessionStatus(s: ClinicSessionTreeNode): SlotStatus {
  const max = s.max_participants;
  if (max == null || max <= 0) return "normal";
  const booked = s.booked_count ?? 0;
  if (booked >= max) return "full";
  if (booked >= Math.ceil(max * 0.8)) return "almost";
  return "normal";
}

function getSlotStatus(sessions: ClinicSessionTreeNode[]): SlotStatus {
  if (!sessions.length) return "normal";
  let status: SlotStatus = "normal";
  for (const s of sessions) {
    const st = getSessionStatus(s);
    if (st === "full") return "full";
    if (st === "almost") status = "almost";
  }
  return status;
}

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

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
  sessionsForDay = [],
  rows,
  onDeleteSession,
}: {
  date: string;
  sessionsForDay?: ClinicSessionTreeNode[];
  rows: ClinicParticipant[];
  /** 세션 삭제 시 호출 (미제공 시 삭제 버튼 비표시) */
  onDeleteSession?: (sessionId: number, label: string) => void;
}) {
  const hasSessions = sessionsForDay.length > 0;
  const hasRows = rows.length > 0;

  if (!hasSessions && !hasRows) {
    return (
      <div className="ds-card-modal clinic-panel overflow-hidden">
        <div className="ds-card-modal__header">
          <div className="ds-card-modal__accent" aria-hidden />
          <div className="ds-card-modal__header-inner">
            <h2 className="ds-card-modal__header-title">클리닉 일정</h2>
            <p className="ds-card-modal__header-description">{date}</p>
          </div>
        </div>
        <div className="ds-card-modal__body">
          <div className="clinic-empty-state">
            <EmptyCalendarIcon className="clinic-empty-state__icon" />
            <p className="clinic-empty-state__text">이 날은 일정이 없습니다.</p>
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

  const sessionTimes = [...new Set(sessionsForDay.map((s) => formatTime(s.start_time)))].sort();
  const times = sessionTimes.length
    ? sessionTimes
    : Object.keys(byTime).sort((a, b) => (a > b ? 1 : -1));

  return (
    <div className="ds-card-modal clinic-panel overflow-hidden">
      <div className="ds-card-modal__header">
        <div className="ds-card-modal__accent" aria-hidden />
        <div className="ds-card-modal__header-inner">
          <h2 className="ds-card-modal__header-title">클리닉 일정</h2>
          <p className="ds-card-modal__header-description">{date}</p>
        </div>
      </div>
      <div className="ds-card-modal__body space-y-5">
        {times.map((time) => {
          const sessionsAtTime = sessionsForDay.filter((s) => formatTime(s.start_time) === time);
          const items = byTime[time] ?? [];
          const slotStatus = getSlotStatus(sessionsAtTime);
          return (
            <section
              key={time}
              className={cx(
                "clinic-section clinic-schedule-slot",
                slotStatus === "normal" && "clinic-schedule-slot--status-normal",
                slotStatus === "almost" && "clinic-schedule-slot--status-almost",
                slotStatus === "full" && "clinic-schedule-slot--status-full"
              )}
            >
              <div className="clinic-section__header">
                <p className="clinic-section__title">{time}</p>
              </div>
              {sessionsAtTime.length > 0 && (
                <div className="clinic-session-cards">
                  {sessionsAtTime.map((s) => {
                    const sessionStatus = getSessionStatus(s);
                    const booked = s.booked_count ?? 0;
                    return (
                      <div
                        key={s.id}
                        className={cx(
                          "clinic-session-card",
                          sessionStatus === "normal" && "clinic-session-card--normal",
                          sessionStatus === "almost" && "clinic-session-card--almost",
                          sessionStatus === "full" && "clinic-session-card--full"
                        )}
                      >
                        <span className="clinic-session-card__bar" aria-hidden />
                        <div className="clinic-session-card__body">
                          <span className="clinic-session-card__location">
                            {s.title || s.location || "—"}
                            {s.target_grade ? ` · ${s.target_grade}학년` : ""}
                          </span>
                          <span className="clinic-session-card__count">예약 {booked}명</span>
                        </div>
                        {onDeleteSession && (
                          <button
                            type="button"
                            onClick={() =>
                              onDeleteSession(s.id, `${formatTime(s.start_time)} ${s.location}`)
                            }
                            className="clinic-session-card__delete"
                            title="클리닉 삭제"
                            aria-label={`${s.location} 클리닉 삭제`}
                          >
                            <Trash2 size={18} strokeWidth={2} aria-hidden />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <ul className="clinic-schedule-slot__list space-y-2">
                {items.length > 0 ? (
                  items.map((r) => (
                    <li
                      key={r.id}
                      className="ds-section__item rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-3 cursor-default"
                    >
                      <div className="ds-section__item-label">
                        <StudentNameWithLectureChip
                          name={r.student_name}
                          lectures={r.lecture_title ? [{ lectureName: r.lecture_title, color: r.lecture_color, chipLabel: r.lecture_chip_label }] : undefined}
                        />
                      </div>
                      {r.session_location && (
                        <div className="ds-section__item-meta">{r.session_location}</div>
                      )}
                    </li>
                  ))
                ) : sessionsAtTime.length > 0 ? (
                  <li className="ds-section__empty clinic-schedule-slot__empty rounded-lg border border-dashed border-[var(--color-border-divider)] px-4 py-3 text-[var(--color-text-muted)]">
                    예약 없음
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
