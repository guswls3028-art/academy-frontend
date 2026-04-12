// -- Agent Seat: Compact desk tile for office floor map ------------------------------------
import { STATUS_META, ROLE_LABELS } from "@dev/domains/agent/types/agent";
import type { AgentState, AgentStatus } from "@dev/domains/agent/types/agent";
import { PixelCharacter } from "./PixelCharacter";
import { formatDuration } from "./agentUtils";
import s from "./AgentDeskCard.module.css";

interface AgentDeskCardProps {
  agent: AgentState;
  isSelected: boolean;
  onClick: () => void;
  tick: number;
}

export function AgentDeskCard({ agent, isSelected, onClick, tick }: AgentDeskCardProps) {
  const meta = STATUS_META[agent.status as AgentStatus] || STATUS_META.queued;
  void tick; // force re-render on tick
  const elapsed = formatDuration(Date.now() - agent.startedAt);

  const stateClass =
    agent.status === "failed" ? s.seatFailed
    : agent.status === "blocked" ? s.seatBlocked
    : agent.status === "done" ? s.seatDone
    : ["coding", "planning", "reading", "testing", "reviewing", "deploying"].includes(agent.status) ? s.seatActive
    : "";

  return (
    <button
      className={`${s.seat} ${isSelected ? s.seatSelected : ""} ${stateClass}`}
      onClick={onClick}
      type="button"
      title={`${agent.displayName} - ${meta.label}`}
    >
      {/* Status LED */}
      <span className={s.statusLed} style={{ background: meta.color }} />

      {/* Avatar */}
      <div className={s.seatAvatar}>
        <PixelCharacter status={agent.status as AgentStatus} role={agent.role} size={24} />
      </div>

      {/* Name */}
      <div className={s.seatName}>{agent.displayName}</div>

      {/* Status badge */}
      <span
        className={s.seatBadge}
        style={{ color: meta.color, background: meta.bgColor }}
      >
        {meta.label}
      </span>

      {/* Current task */}
      <div className={s.seatTask} title={agent.taskTitle}>
        {agent.taskTitle || "\u2014"}
      </div>

      {/* Role + Elapsed */}
      <div className={s.seatMeta}>
        <span className={s.seatRole}>{ROLE_LABELS[agent.role as keyof typeof ROLE_LABELS] || agent.role}</span>
        <span className={s.seatElapsed}>{elapsed}</span>
      </div>
    </button>
  );
}
