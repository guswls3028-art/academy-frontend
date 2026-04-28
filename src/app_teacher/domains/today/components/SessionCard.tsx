// PATH: src/app_teacher/domains/today/components/SessionCard.tsx
// 수업 카드 — LectureChip + 진행상태 + 출결 진척 + 퀵 액션(출석/성적)
import { useNavigate } from "react-router-dom";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { Check, Edit3 } from "@teacher/shared/ui/Icons";
import { Badge } from "@teacher/shared/ui/Badge";
import type { TodaySession } from "../api";

interface Props {
  session: TodaySession;
}

type SessionPhase = "upcoming" | "ongoing" | "ended" | "unknown";

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
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--tc-surface)",
        border: "1px solid var(--tc-border)",
        boxShadow: "var(--tc-shadow-sm)",
        opacity: phase === "ended" ? 0.78 : 1,
      }}
    >
      {/* Body — 탭하면 세션 상세 */}
      <button
        className="w-full text-left flex items-center gap-3"
        onClick={() =>
          navigate(`/teacher/classes/${session.lecture}/sessions/${session.id}`)
        }
        style={{
          padding: "var(--tc-space-3) var(--tc-space-4)",
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
      >
        <LectureChip
          lectureName={session.lecture_title ?? session.title}
          color={session.lecture_color ?? undefined}
          size={36}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div
              className="text-[15px] font-bold truncate"
              style={{ color: "var(--tc-text)" }}
            >
              {session.lecture_title || session.title}
              {session.section_label && (
                <span
                  className="font-medium ml-1"
                  style={{ color: "var(--tc-text-secondary)" }}
                >
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
            <div
              className="text-[12px] mt-0.5"
              style={{ color: "var(--tc-text-muted)" }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </button>

      {/* Attendance progress */}
      {hasProgress && (
        <div style={{ padding: "0 var(--tc-space-4) var(--tc-space-2)" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
            <span className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
              출결 입력
            </span>
            <span
              className="text-[11px] font-semibold"
              style={{
                color: attendanceDone ? "var(--tc-success)" : "var(--tc-text-secondary)",
              }}
            >
              {filled} / {total}
              {attendanceDone && " ✓"}
            </span>
          </div>
          <div
            style={{
              height: 4,
              borderRadius: 2,
              background: "var(--tc-surface-soft)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: "100%",
                background: attendanceDone ? "var(--tc-success)" : "var(--tc-primary)",
                transition: "width var(--tc-motion-base)",
              }}
            />
          </div>
        </div>
      )}

      {/* Quick action buttons */}
      <div
        className="flex gap-2"
        style={{ padding: "0 var(--tc-space-4) var(--tc-space-3)" }}
      >
        <QuickBtn
          icon={<Check size={14} />}
          label={attendanceDone ? "출석 완료" : "출석"}
          color="var(--tc-success)"
          done={attendanceDone}
          ariaLabel={`${session.lecture_title || session.title} 출석 입력`}
          onClick={() => navigate(`/teacher/attendance/${session.id}`)}
        />
        <QuickBtn
          icon={<Edit3 size={14} />}
          label="성적"
          color="var(--tc-primary)"
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
  color,
  done,
  ariaLabel,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  done?: boolean;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={ariaLabel}
      className="flex items-center gap-1.5 rounded-full text-[13px] font-semibold cursor-pointer"
      style={{
        padding: "6px 16px",
        border: `1px solid ${done ? "transparent" : color}`,
        background: done ? color : "transparent",
        color: done ? "#fff" : color,
        transition: "all var(--tc-motion-fast)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
