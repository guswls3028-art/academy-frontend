// ── Agent Detail Panel: Side panel with full agent info + event timeline ─────
import { STATUS_META, ROLE_LABELS } from "@/dev_app/types/agent";
import type { AgentState, AgentStatus } from "@/dev_app/types/agent";
import { PixelCharacter } from "./PixelCharacter";
import { formatDuration, formatTime } from "./agentUtils";
import s from "./AgentDetailPanel.module.css";

interface AgentDetailPanelProps {
  agent: AgentState;
  onClose: () => void;
  tick: number;
}

export function AgentDetailPanel({ agent, onClose, tick }: AgentDetailPanelProps) {
  const meta = STATUS_META[agent.status as AgentStatus] || STATUS_META.queued;
  void tick; // force re-render on tick
  const elapsed = formatDuration(Date.now() - agent.startedAt);
  const events = [...agent.events].reverse();

  return (
    <div className={s.detailPanel}>
      <div className={s.detailHeader}>
        <div className={s.detailTitle}>
          <PixelCharacter status={agent.status as AgentStatus} role={agent.role} size={32} />
          <div>
            <h3 className={s.detailName}>{agent.displayName}</h3>
            <span
              className={s.statusBadge}
              style={{ color: meta.color, background: meta.bgColor }}
            >
              {meta.label}
            </span>
          </div>
        </div>
        <button className={s.detailClose} onClick={onClose} type="button" aria-label="Close">&times;</button>
      </div>

      <div className={s.detailBody}>
        {/* Data source hint */}
        <div className={s.dataSourceHint}>
          Status and target are inferred from tool calls via Claude Code hooks.
          Events are directly observed.
        </div>

        {/* Info grid */}
        <div className={s.detailGrid}>
          <InfoRow label="ID" value={agent.agentId} mono />
          <InfoRow label="Role" value={`${ROLE_LABELS[agent.role as keyof typeof ROLE_LABELS] || agent.role}`} />
          <InfoRow label="Task" value={agent.taskTitle || "\u2014"} />
          <InfoRow label="Target" value={agent.currentTarget || "\u2014"} mono />
          <InfoRow label="Elapsed" value={elapsed} />
          {agent.progressPercent != null && (
            <InfoRow label="Progress" value={`${agent.progressPercent}%`} />
          )}
          <InfoRow label="Started" value={formatTime(agent.startedAt)} />
          <InfoRow label="Updated" value={formatTime(agent.updatedAt)} />
        </div>

        {/* Error */}
        {agent.errorSummary && (
          <div className={s.errorBox}>
            <div className={s.errorLabel}>Error</div>
            <div className={s.errorText}>{agent.errorSummary}</div>
          </div>
        )}

        {/* Recent log */}
        {agent.recentLog && (
          <div className={s.logBox}>
            <div className={s.logLabel}>Recent Log</div>
            <pre className={s.logPre}>{agent.recentLog}</pre>
          </div>
        )}

        {/* Event timeline */}
        <div className={s.timelineSection}>
          <div className={s.timelineLabel}>Event Timeline ({agent.events.length})</div>
          <div className={s.timeline}>
            {events.length === 0 && <div className={s.timelineEmpty}>No events recorded</div>}
            {events.map((ev) => (
              <div key={ev.id} className={s.timelineItem}>
                <div className={`${s.timelineDot} ${
                  ev.severity === "error" ? s.timelineDotError :
                  ev.severity === "warn" ? s.timelineDotWarn : ""
                }`} />
                <div className={s.timelineContent}>
                  <span className={s.timelineType}>{ev.type}</span>
                  <span className={s.timelineMsg}>{ev.message}</span>
                  {ev.target && <span className={s.timelineTarget}>{ev.target}</span>}
                </div>
                <div className={s.timelineTime}>{formatTime(ev.timestamp)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <div className={s.infoLabel}>{label}</div>
      <div className={`${s.infoValue} ${mono ? s.mono : ""}`}>{value}</div>
    </>
  );
}
