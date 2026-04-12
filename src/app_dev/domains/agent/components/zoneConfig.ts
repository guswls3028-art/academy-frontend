import type { AgentRole } from "@dev/domains/agent/types/agent";

export type ZoneLayout = "meeting" | "focus" | "open" | "booth" | "console" | "bench" | "alert";

export interface ZoneConfig {
  id: string;
  name: string;
  icon: string;
  roles: AgentRole[];
  accentColor: string;
  borderAccent: string; // left border accent for zone identity
  column: 1 | 2 | 3;
  order: number;
  layout: ZoneLayout; // determines internal desk arrangement style
  maxCols: number; // max columns in desk grid
}

export const ZONES: ZoneConfig[] = [
  { id: "strategy", name: "Strategy Room", icon: "◈", roles: ["planner", "explorer"],
    accentColor: "rgba(139, 92, 246, 0.05)", borderAccent: "#8b5cf6",
    column: 1, order: 1, layout: "meeting", maxCols: 3 },
  { id: "review", name: "Review Room", icon: "◉", roles: ["reviewer"],
    accentColor: "rgba(99, 102, 241, 0.05)", borderAccent: "#6366f1",
    column: 1, order: 2, layout: "focus", maxCols: 2 },
  { id: "engineering", name: "Engineering Floor", icon: "⚙", roles: ["implementer"],
    accentColor: "rgba(16, 185, 129, 0.04)", borderAccent: "#10b981",
    column: 2, order: 1, layout: "open", maxCols: 4 },
  { id: "qa", name: "QA Lab", icon: "◎", roles: ["tester"],
    accentColor: "rgba(245, 158, 11, 0.05)", borderAccent: "#f59e0b",
    column: 3, order: 1, layout: "booth", maxCols: 2 },
  { id: "ops", name: "Ops Desk", icon: "▣", roles: ["deployer"],
    accentColor: "rgba(249, 115, 22, 0.05)", borderAccent: "#f97316",
    column: 3, order: 2, layout: "console", maxCols: 2 },
  { id: "pool", name: "Reserve Pool", icon: "◻", roles: ["general"],
    accentColor: "rgba(100, 116, 139, 0.03)", borderAccent: "#64748b",
    column: 2, order: 2, layout: "bench", maxCols: 4 },
];

export const INCIDENT_ZONE: ZoneConfig = {
  id: "incident", name: "Incident Desk", icon: "⚠", roles: [],
  accentColor: "rgba(239, 68, 68, 0.05)", borderAccent: "#ef4444",
  column: 3, order: 3, layout: "alert", maxCols: 2,
};

export function getZoneForAgent(role: AgentRole, status: string): string {
  if (status === "blocked" || status === "failed") return "incident";
  const zone = ZONES.find(z => z.roles.includes(role));
  return zone?.id || "pool";
}
