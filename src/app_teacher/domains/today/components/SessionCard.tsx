// PATH: src/app_teacher/domains/today/components/SessionCard.tsx
// 수업 카드 — LectureChip + 퀵 액션(출석/성적)
import { useNavigate } from "react-router-dom";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { Check, Edit3 } from "@teacher/shared/ui/Icons";
import type { TodaySession } from "../api";

interface Props {
  session: TodaySession;
}

export default function SessionCard({ session }: Props) {
  const navigate = useNavigate();
  const timeStr =
    session.start_time && session.end_time
      ? `${session.start_time.slice(0, 5)} – ${session.end_time.slice(0, 5)}`
      : null;
  const subtitle = [timeStr, session.location, session.section_label]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--tc-surface)",
        border: "1px solid var(--tc-border)",
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
          <div className="text-[15px] font-bold" style={{ color: "var(--tc-text)" }}>
            {session.lecture_title || session.title}
            {session.section_label && (
              <span className="font-medium ml-1" style={{ color: "var(--tc-text-secondary)" }}>
                {session.section_label}
              </span>
            )}
          </div>
          {subtitle && (
            <div className="text-[12px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
              {subtitle}
            </div>
          )}
        </div>
      </button>

      {/* Quick action buttons */}
      <div
        className="flex gap-2"
        style={{ padding: "0 var(--tc-space-4) var(--tc-space-3)" }}
      >
        <QuickBtn
          icon={<Check size={14} />}
          label="출석"
          color="var(--tc-success)"
          onClick={() => navigate(`/teacher/attendance/${session.id}`)}
        />
        <QuickBtn
          icon={<Edit3 size={14} />}
          label="성적"
          color="var(--tc-primary)"
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
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex items-center gap-1.5 rounded-full text-[13px] font-semibold cursor-pointer"
      style={{
        padding: "6px 16px",
        border: `1px solid ${color}`,
        background: "transparent",
        color,
      }}
    >
      {icon}
      {label}
    </button>
  );
}
