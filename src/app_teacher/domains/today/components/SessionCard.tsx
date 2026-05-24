// PATH: src/app_teacher/domains/today/components/SessionCard.tsx
// 수업 카드 — LectureChip + 진행상태 + 출결 진척 + 퀵 액션(출석/성적)
import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { ICON } from "@/shared/ui/ds";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { Check, Edit3 } from "@teacher/shared/ui/Icons";
import { Badge } from "@teacher/shared/ui/Badge";
import type { TodaySession } from "../api";
import styles from "./SessionCard.module.css";

interface Props {
  session: TodaySession;
}

type SessionPhase = "upcoming" | "ongoing" | "ended" | "unknown";
type QuickButtonVariant = "success" | "primary";

const QUICK_BUTTON_CLASS: Record<QuickButtonVariant, { idle: string; done: string }> = {
  success: { idle: styles.quickButtonSuccess, done: styles.quickButtonSuccessDone },
  primary: { idle: styles.quickButtonPrimary, done: styles.quickButtonPrimaryDone },
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

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

export default function SessionCard({ session }: Props) {
  const navigate = useNavigate();
  const timeStr =
    session.start_time && session.end_time
      ? `${session.start_time.slice(0, 5)} – ${session.end_time.slice(0, 5)}`
      : null;
  const subtitle = [timeStr, session.location, session.section_label]
    .filter(Boolean)
    .join(" · ");

  const phase = getPhase(session.start_time, session.end_time);
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
        onClick={() =>
          navigate(`/teacher/classes/${session.lecture}/sessions/${session.id}`)
        }
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

      {/* Attendance progress */}
      {hasProgress && (
        <div className={styles.progressSection}>
          <div className={styles.progressHeader}>
            <span className={styles.progressLabel}>
              출결 입력
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
          onClick={() => navigate(`/teacher/attendance/${session.id}`)}
        />
        <QuickBtn
          icon={<Edit3 size={ICON.xs} />}
          label="성적"
          variant="primary"
          ariaLabel={`${session.lecture_title || session.title} 성적 입력`}
          onClick={() => navigate(`/teacher/scores/${session.id}`)}
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
}: {
  icon: ReactNode;
  label: string;
  variant: QuickButtonVariant;
  done?: boolean;
  ariaLabel: string;
  onClick: () => void;
}) {
  const variantClass = QUICK_BUTTON_CLASS[variant];

  return (
    <button
      type="button"
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
