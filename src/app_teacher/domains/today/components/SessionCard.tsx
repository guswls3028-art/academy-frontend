// PATH: src/app_teacher/domains/today/components/SessionCard.tsx
// 수업 카드 — 오늘 화면 핵심 UI. 퀵 액션(출석/성적) 제공
import { useNavigate } from "react-router-dom";
import type { TodaySession } from "../api";

const LECTURE_COLORS: Record<string, string> = {
  blue: "#3b82f6",
  green: "#22c55e",
  red: "#ef4444",
  purple: "#8b5cf6",
  orange: "#f97316",
  yellow: "#eab308",
  pink: "#ec4899",
  cyan: "#06b6d4",
};

interface Props {
  session: TodaySession;
}

export default function SessionCard({ session }: Props) {
  const navigate = useNavigate();
  const color =
    LECTURE_COLORS[session.lecture_color || ""] || "var(--tc-primary)";
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
      {/* Color accent top bar */}
      <div style={{ height: 3, background: color }} />

      {/* Body — 탭하면 세션 상세 */}
      <button
        className="w-full text-left"
        onClick={() =>
          navigate(
            `/teacher/classes/${session.lecture}/sessions/${session.id}`,
          )
        }
        style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: color }}
          />
          <span
            className="text-[15px] font-bold"
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
          </span>
        </div>
        {subtitle && (
          <div
            className="text-[13px] ml-4 mb-1"
            style={{ color: "var(--tc-text-secondary)" }}
          >
            {subtitle}
          </div>
        )}
      </button>

      {/* Quick action buttons */}
      <div
        className="flex gap-2"
        style={{ padding: "0 var(--tc-space-4) var(--tc-space-3)" }}
      >
        <QuickBtn
          label="출석"
          color="var(--tc-success)"
          onClick={() => navigate(`/teacher/attendance/${session.id}`)}
        />
        <QuickBtn
          label="성적"
          color="var(--tc-primary)"
          onClick={() => navigate(`/teacher/scores/${session.id}`)}
        />
      </div>
    </div>
  );
}

function QuickBtn({
  label,
  color,
  onClick,
}: {
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
      className="rounded-full text-[13px] font-semibold cursor-pointer"
      style={{
        padding: "6px 16px",
        border: `1px solid ${color}`,
        background: "transparent",
        color,
      }}
    >
      {label}
    </button>
  );
}
