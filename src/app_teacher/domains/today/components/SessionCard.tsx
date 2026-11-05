// PATH: src/app_teacher/domains/today/components/SessionCard.tsx
// 수업 카드 — LectureChip + 진행상태 + 출결 진척 + 퀵 액션(출석/성적)
import { useNavigate } from "react-router";
import { useRef, useState, type ReactNode } from "react";
import { Button, ICON } from "@/shared/ui/ds";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { cx } from "@/shared/utils/cx";
import { Check, Edit3 } from "@teacher/shared/ui/Icons";
import { Badge } from "@teacher/shared/ui/Badge";
import type { TodaySession } from "../api";
import styles from "./SessionCard.module.css";

interface Props {
  session: TodaySession;
  date: string;
  onRefresh: () => void;
}

type SessionPhase = "upcoming" | "ongoing" | "ended" | "unknown";
type QuickButtonVariant = "success" | "primary";

const QUICK_BUTTON_CLASS: Record<QuickButtonVariant, { idle: string; done: string }> = {
  success: { idle: styles.quickButtonSuccess, done: styles.quickButtonSuccessDone },
  primary: { idle: styles.quickButtonPrimary, done: styles.quickButtonPrimaryDone },
};

function toMinutes(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = hhmm.match(/^(\d{2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function getPhase(start?: string | null, end?: string | null): SessionPhase {
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  if (startMin == null || endMin == null) return "unknown";
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  if (cur < startMin) return "upcoming";
  if (cur >= startMin && cur < endMin) return "ongoing";
  return "ended";
}

const PHASE_BADGE: Record<SessionPhase, { label: string; tone: "info" | "primary" | "neutral" } | null> = {
  upcoming: { label: "예정", tone: "info" },
  ongoing: { label: "진행중", tone: "primary" },
  ended: { label: "종료", tone: "neutral" },
  unknown: null,
};

export default function SessionCard({ session, date, onRefresh }: Props) {
  const navigate = useNavigate();
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const choiceRef = useRef<HTMLDivElement>(null);
  const configured = Boolean(session.schedule_dates?.length);
  const matching = session.schedule_dates?.filter(s => s.date === date) ?? [];
  const selected = matching.length === 1 ? matching[0] : matching.find(s => s.id === selectedScheduleId);
  const current = configured ? selected : session;
  const scopedSuffix = selected ? `?schedule=${selected.id}` : '';
  const needsChoice = configured && !selected;
  const timeStr =
    current?.start_time && current.end_time
      ? `${current.start_time.slice(0, 5)} – ${current.end_time.slice(0, 5)}`
      : null;
  const subtitle = [configured ? matching.map(s => s.label).join(' · ') || '수업일 확인 필요' : null, timeStr, session.location, session.section_label]
    .filter(Boolean)
    .join(" · ");

  const phase = getPhase(current?.start_time, current?.end_time);
  const phaseBadge = PHASE_BADGE[phase];

  const filled = session.attendance_filled ?? 0;
  const total = session.attendance_total ?? 0;
  const hasProgress = total > 0;
  const attendanceDone = hasProgress && filled >= total;
  const progressPct = hasProgress ? Math.min(100, Math.round((filled / total) * 100)) : 0;

  return (
    <div className={cx(styles.card, phase === "ended" && styles.cardEnded)}>
      {/* Body — 탭하면 세션 상세 */}
      <button
        type="button"
        className={styles.bodyButton}
        onClick={() => {
          if (configured && !matching.length) { onRefresh(); return; }
          if (needsChoice) { choiceRef.current?.querySelector('button')?.focus(); return; }
          navigate(`/workspace/mobile/classes/${session.lecture}/sessions/${session.id}${scopedSuffix}`);
        }}
      >
        <LectureChip
          lectureName={session.lecture_title ?? session.title}
          color={session.lecture_color ?? undefined}
          chipLabel={session.lecture_chip_label ?? undefined}
          size={36}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className={styles.title}>
              {session.lecture_title || session.title}
              {session.section_label && (
                <span className={styles.sectionLabel}>
                  {session.section_label}
                </span>
              )}
            </div>
            {phaseBadge && (
              <Badge tone={phaseBadge.tone} size="xs" pill>
                {phaseBadge.label}
              </Badge>
            )}
          </div>
          {subtitle && (
            <div className={styles.subtitle}>
              {subtitle}
            </div>
          )}
        </div>
      </button>

      {configured && matching.length > 1 && <div ref={choiceRef} className="flex flex-wrap gap-2 px-3 pb-3" role="group" aria-label="오늘 수업일 선택">
        <p className="w-full text-xs">수업일을 선택하면 해당 학생의 출석·성적을 열 수 있습니다.</p>
        {matching.map(s => <Button key={s.id} size="sm" intent={selected?.id === s.id ? 'primary' : 'secondary'} aria-pressed={selected?.id === s.id} onClick={() => setSelectedScheduleId(s.id)}>{s.label}{s.start_time ? ` · ${s.start_time.slice(0, 5)}` : ''}</Button>)}
      </div>}
      {configured && !matching.length && <div className="px-3 pb-3" role="alert"><p className="text-sm">오늘 수업일을 확인하지 못했습니다.</p><Button size="sm" onClick={onRefresh}>수업일 다시 불러오기</Button></div>}

      {/* Attendance progress */}
      {hasProgress && (
        <div className={styles.progressSection}>
          <div className={styles.progressHeader}>
            <span className={styles.progressLabel}>
              {configured ? '오늘 수업일 출결 입력' : '출결 입력'}
            </span>
            <span
              className={cx(
                styles.progressValue,
                attendanceDone && styles.progressValueDone,
              )}
            >
              {filled} / {total}
              {attendanceDone && " ✓"}
            </span>
          </div>
          <progress
            className={cx(styles.progressBar, attendanceDone && styles.progressBarDone)}
            value={progressPct}
            max={100}
            aria-label="출결 입력 진행률"
          />
        </div>
      )}

      {/* Quick action buttons */}
      <div className={styles.actions}>
        <QuickBtn
          icon={<Check size={ICON.xs} />}
          label={attendanceDone ? "출석 완료" : "출석"}
          variant="success"
          done={attendanceDone}
          ariaLabel={`${session.lecture_title || session.title} 출석 입력`}
          disabled={needsChoice}
          onClick={() => navigate(`/workspace/mobile/attendance/${session.id}${scopedSuffix}`)}
        />
        <QuickBtn
          icon={<Edit3 size={ICON.xs} />}
          label="성적"
          variant="primary"
          ariaLabel={`${session.lecture_title || session.title} 성적 입력`}
          disabled={needsChoice}
          onClick={() => navigate(`/workspace/mobile/scores/${session.id}${scopedSuffix}`)}
        />
      </div>
    </div>
  );
}

function QuickBtn({
  icon,
  label,
  variant,
  done,
  ariaLabel,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  variant: QuickButtonVariant;
  done?: boolean;
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const variantClass = QUICK_BUTTON_CLASS[variant];

  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? '오늘 수업일을 먼저 선택하거나 다시 불러와 주세요.' : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={ariaLabel}
      className={cx(styles.quickButton, done ? variantClass.done : variantClass.idle)}
    >
      {icon}
      {label}
    </button>
  );
}
