// -- Agent Monitor: Office Floor Map Dashboard ------------------------------------------------
// Zone-based layout with office metaphor. Agents are grouped by role into team zones.

import { useEffect, useMemo, useState } from "react";
import { useAgentStream } from "@dev/domains/agent/hooks/useAgentStream";
import { STATUS_META } from "@dev/domains/agent/types/agent";
import type { AgentState, AgentStatus } from "@dev/domains/agent/types/agent";
import { AgentDeskCard } from "@dev/domains/agent/components/AgentDeskCard";
import { AgentDetailPanel } from "@dev/domains/agent/components/AgentDetailPanel";
import { PixelDesk } from "@dev/domains/agent/components/PixelCharacter";
import { ZONES, INCIDENT_ZONE, getZoneForAgent } from "@dev/domains/agent/components/zoneConfig";
import type { ZoneConfig } from "@dev/domains/agent/components/zoneConfig";
import s from "./AgentMonitorPage.module.css";

type FilterMode = "all" | "active" | "blocked" | "done" | "failed";
type ViewMode = "office" | "list";

export default function AgentMonitorPage() {
  const { agentList, connected, sessionId, loadDemo, resetSession } = useAgentStream();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("office");

  // -- Tick for live elapsed time --
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // -- Summary counts --
  const counts = useMemo(() => {
    const c = { total: 0, active: 0, waiting: 0, blocked: 0, done: 0, failed: 0 };
    for (const a of agentList) {
      c.total++;
      if (a.status === "done") c.done++;
      else if (a.status === "failed") c.failed++;
      else if (a.status === "blocked") c.blocked++;
      else if (a.status === "waiting" || a.status === "queued") c.waiting++;
      else c.active++;
    }
    return c;
  }, [agentList]);

  // -- Filtered list --
  const filtered = useMemo(() => {
    if (filter === "all") return agentList;
    return agentList.filter((a) => {
      if (filter === "active") return !["done", "failed", "blocked", "waiting", "queued"].includes(a.status);
      if (filter === "blocked") return a.status === "blocked";
      if (filter === "done") return a.status === "done";
      if (filter === "failed") return a.status === "failed";
      return true;
    });
  }, [agentList, filter]);

  // -- Zone assignment --
  const zoneAgents = useMemo(() => {
    const map: Record<string, AgentState[]> = {};
    for (const z of ZONES) map[z.id] = [];
    map[INCIDENT_ZONE.id] = [];
    for (const agent of filtered) {
      const zoneId = getZoneForAgent(agent.role, agent.status);
      if (!map[zoneId]) map[zoneId] = [];
      map[zoneId].push(agent);
    }
    return map;
  }, [filtered]);

  // -- All zone configs with column/order sorting --
  const allZones = useMemo(() => {
    return [...ZONES, INCIDENT_ZONE].sort((a, b) => {
      if (a.column !== b.column) return a.column - b.column;
      return a.order - b.order;
    });
  }, []);

  // -- Zones by column --
  const columns = useMemo(() => {
    const cols: Record<number, ZoneConfig[]> = { 1: [], 2: [], 3: [] };
    for (const z of allZones) {
      cols[z.column].push(z);
    }
    return cols;
  }, [allZones]);

  const selected = selectedAgent ? agentList.find((a) => a.agentId === selectedAgent) : null;

  return (
    <div className={s.page}>
      {/* -- Header -- */}
      <div className={s.pageHeader}>
        <div className={s.headerLeft}>
          <h1 className={s.pageTitle}>Agent Monitor</h1>
          <span className={`${s.connBadge} ${connected ? s.connOn : s.connOff}`}>
            <span className={s.connDot} aria-hidden="true" />
            {connected ? "LIVE" : "DISCONNECTED"}
          </span>
          {sessionId && <span className={s.sessionId}>session: {sessionId.slice(0, 8)}</span>}
        </div>
        <div className={s.headerRight}>
          <span className={s.liveHint}>hooks auto-bridge active</span>
          <button className={s.actionBtn} onClick={resetSession}>Reset</button>
          <button className={`${s.actionBtn} ${s.actionBtnMuted}`} onClick={loadDemo} title="Load simulated agents for UI testing only">Demo</button>
        </div>
      </div>

      {/* -- Summary Bar -- */}
      <div className={s.summaryBar}>
        <SummaryChip label="Workforce" value={counts.total} color="#475569" onClick={() => setFilter("all")} />
        <SummaryChip label="Active" value={counts.active} color="#10b981" onClick={() => setFilter("active")} />
        <SummaryChip label="Waiting" value={counts.waiting} color="#64748b" onClick={() => setFilter("all")} />
        <SummaryChip label="Incidents" value={counts.blocked} color="#f59e0b" onClick={() => setFilter("blocked")} />
        <SummaryChip label="Failed" value={counts.failed} color="#ef4444" onClick={() => setFilter("failed")} />
        <SummaryChip label="Done" value={counts.done} color="#2dd4bf" onClick={() => setFilter("done")} />
      </div>

      {/* -- Filter + View Toggle Bar -- */}
      <div className={s.controlBar}>
        <div className={s.filterBar}>
          {(["all", "active", "blocked", "failed", "done"] as FilterMode[]).map((f) => (
            <button
              key={f}
              className={`${s.filterTab} ${filter === f ? s.filterTabActive : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className={s.viewToggle}>
          <button
            className={`${s.viewBtn} ${viewMode === "office" ? s.viewBtnActive : ""}`}
            onClick={() => setViewMode("office")}
            title="Office floor view"
          >
            Office
          </button>
          <button
            className={`${s.viewBtn} ${viewMode === "list" ? s.viewBtnActive : ""}`}
            onClick={() => setViewMode("list")}
            title="Flat list view"
          >
            List
          </button>
        </div>
      </div>

      {/* -- Main Content -- */}
      <div className={s.mainArea}>
        <div className={s.officeScene}>
          {filtered.length === 0 && agentList.length === 0 ? (
            <div className={s.emptyOffice}>
              <div className={s.emptyIcon}><PixelDesk /></div>
              <p className={s.emptyText}>
                No agents running. Agent activity will appear here automatically when Claude Code runs parallel agents (via hooks bridge).
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className={s.emptyOffice}>
              <p className={s.emptyText}>No agents match the current filter.</p>
            </div>
          ) : viewMode === "office" ? (
            <div className={s.officeFloor}>
              <div className={s.floorColumn}>
                {columns[1].map(zone => (
                  <OfficeZone
                    key={zone.id}
                    zone={zone}
                    agents={zoneAgents[zone.id] || []}
                    selectedAgent={selectedAgent}
                    onSelectAgent={setSelectedAgent}
                    tick={tick}
                  />
                ))}
              </div>
              <div className={s.floorColumn}>
                {columns[2].map(zone => (
                  <OfficeZone
                    key={zone.id}
                    zone={zone}
                    agents={zoneAgents[zone.id] || []}
                    selectedAgent={selectedAgent}
                    onSelectAgent={setSelectedAgent}
                    tick={tick}
                  />
                ))}
              </div>
              <div className={s.floorColumn}>
                {columns[3].map(zone => (
                  <OfficeZone
                    key={zone.id}
                    zone={zone}
                    agents={zoneAgents[zone.id] || []}
                    selectedAgent={selectedAgent}
                    onSelectAgent={setSelectedAgent}
                    tick={tick}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className={s.listFloor}>
              <div className={s.deskGrid}>
                {filtered.map((agent) => (
                  <AgentDeskCard
                    key={agent.agentId}
                    agent={agent}
                    isSelected={selectedAgent === agent.agentId}
                    onClick={() => setSelectedAgent(
                      selectedAgent === agent.agentId ? null : agent.agentId
                    )}
                    tick={tick}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {selected && (
          <AgentDetailPanel
            agent={selected}
            onClose={() => setSelectedAgent(null)}
            tick={tick}
          />
        )}
      </div>
    </div>
  );
}

// -- OfficeZone -----------------------------------------------------------------------
function OfficeZone({ zone, agents, selectedAgent, onSelectAgent, tick }: {
  zone: ZoneConfig;
  agents: AgentState[];
  selectedAgent: string | null;
  onSelectAgent: (id: string | null) => void;
  tick: number;
}) {
  const activeCount = agents.filter(a => !["done", "failed", "blocked", "waiting", "queued"].includes(a.status)).length;
  const blockedCount = agents.filter(a => a.status === "blocked").length;
  const failedCount = agents.filter(a => a.status === "failed").length;

  // Zone-specific CSS class for layout differentiation
  const layoutClass =
    zone.layout === "meeting" ? s.zoneMeeting :
    zone.layout === "focus" ? s.zoneFocus :
    zone.layout === "open" ? s.zoneOpen :
    zone.layout === "booth" ? s.zoneBooth :
    zone.layout === "console" ? s.zoneConsole :
    zone.layout === "bench" ? s.zoneBench :
    zone.layout === "alert" ? s.zoneAlert_ : "";

  const isEmpty = agents.length === 0;

  return (
    <div
      className={`${s.zone} ${layoutClass} ${isEmpty ? s.zoneCompact : ""}`}
      style={{
        background: zone.accentColor,
        borderLeftColor: zone.borderAccent,
      }}
    >
      <div className={s.zoneHeader}>
        <span className={s.zoneIcon}>{zone.icon}</span>
        <span className={s.zoneName}>{zone.name}</span>
        <div className={s.zoneStats}>
          <span className={s.zoneCount}>{agents.length}</span>
          {activeCount > 0 && <span className={s.zoneActive}>{activeCount} active</span>}
          {blockedCount > 0 && <span className={s.zoneBlocked}>{blockedCount} blocked</span>}
          {failedCount > 0 && <span className={s.zoneFailed}>{failedCount} failed</span>}
        </div>
      </div>
      <div
        className={s.zoneDesks}
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${zone.layout === "open" ? "95px" : "105px"}, 1fr))` }}
      >
        {isEmpty ? (
          <div className={s.zoneEmpty}>—</div>
        ) : (
          agents.map(agent => (
            <AgentDeskCard
              key={agent.agentId}
              agent={agent}
              isSelected={selectedAgent === agent.agentId}
              onClick={() => onSelectAgent(
                selectedAgent === agent.agentId ? null : agent.agentId
              )}
              tick={tick}
            />
          ))
        )}
      </div>
    </div>
  );
}

// -- SummaryChip (inline, tightly coupled to page CSS) --
function SummaryChip({ label, value, color, onClick }: { label: string; value: number; color: string; onClick: () => void }) {
  return (
    <button className={s.summaryChip} onClick={onClick} type="button">
      <span className={s.summaryValue} style={{ color }}>{value}</span>
      <span className={s.summaryLabel}>{label}</span>
    </button>
  );
}
