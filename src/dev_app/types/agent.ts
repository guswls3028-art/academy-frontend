// ── Agent Monitor: Event & State Schema ──────────────────────────────────────
// This is the canonical schema for agent monitoring.
// All agent data flows through these types.

export type AgentStatus =
  | "queued"
  | "planning"
  | "reading"
  | "coding"
  | "testing"
  | "reviewing"
  | "waiting"
  | "blocked"
  | "deploying"
  | "done"
  | "failed";

export type AgentRole =
  | "general"
  | "explorer"
  | "planner"
  | "implementer"
  | "tester"
  | "reviewer"
  | "deployer";

export type EventType =
  | "spawned"
  | "assigned"
  | "reading_file"
  | "editing_file"
  | "running_tests"
  | "running_command"
  | "retrying"
  | "waiting_dependency"
  | "blocked"
  | "finished"
  | "failed"
  | "status_change"
  | "log";

export interface AgentEvent {
  id: string;
  agentId: string;
  type: EventType;
  message: string;
  timestamp: number; // epoch ms
  target?: string; // file path, command, etc.
  severity?: "info" | "warn" | "error";
  meta?: Record<string, unknown>;
}

export interface AgentState {
  agentId: string;
  displayName: string;
  role: AgentRole;
  status: AgentStatus;
  taskTitle: string;
  currentTarget: string; // file / subsystem / area
  progressPercent: number | null; // 0-100 or null if unknown
  startedAt: number; // epoch ms
  updatedAt: number; // epoch ms
  recentLog: string;
  errorSummary: string | null;
  events: AgentEvent[];
}

export interface AgentSnapshot {
  agents: AgentState[];
  sessionId: string;
  startedAt: number;
  updatedAt: number;
}

// Inbound event from agent instrumentation
export interface AgentInboundEvent {
  agentId: string;
  displayName?: string;
  role?: AgentRole;
  status?: AgentStatus;
  taskTitle?: string;
  currentTarget?: string;
  progressPercent?: number | null;
  recentLog?: string;
  errorSummary?: string | null;
  eventType?: EventType;
  eventMessage?: string;
  eventTarget?: string;
  severity?: "info" | "warn" | "error";
}

// SSE message types
export type SSEMessageType = "snapshot" | "agent_update" | "agent_event" | "agent_remove";

export interface SSEMessage {
  type: SSEMessageType;
  payload: AgentSnapshot | AgentState | AgentEvent | { agentId: string };
}

// Status metadata for UI rendering (dark-theme semitransparent backgrounds)
export const STATUS_META: Record<AgentStatus, {
  label: string;
  color: string;
  bgColor: string;
  animation: "idle" | "typing" | "reading" | "pulse" | "blink" | "none";
}> = {
  queued:    { label: "대기",   color: "#64748b", bgColor: "rgba(100, 116, 139, 0.12)", animation: "idle" },
  planning:  { label: "기획",   color: "#8b5cf6", bgColor: "rgba(139, 92, 246, 0.12)", animation: "pulse" },
  reading:   { label: "분석",   color: "#3b82f6", bgColor: "rgba(59, 130, 246, 0.12)", animation: "reading" },
  coding:    { label: "코딩",   color: "#10b981", bgColor: "rgba(16, 185, 129, 0.12)", animation: "typing" },
  testing:   { label: "테스트", color: "#f59e0b", bgColor: "rgba(245, 158, 11, 0.12)", animation: "blink" },
  reviewing: { label: "검토",   color: "#6366f1", bgColor: "rgba(99, 102, 241, 0.12)", animation: "reading" },
  waiting:   { label: "대기중", color: "#94a3b8", bgColor: "rgba(148, 163, 184, 0.12)", animation: "idle" },
  blocked:   { label: "차단",   color: "#f59e0b", bgColor: "rgba(245, 158, 11, 0.12)", animation: "blink" },
  deploying: { label: "배포",   color: "#f97316", bgColor: "rgba(249, 115, 22, 0.12)", animation: "pulse" },
  done:      { label: "완료",   color: "#2dd4bf", bgColor: "rgba(45, 212, 191, 0.12)", animation: "none" },
  failed:    { label: "실패",   color: "#ef4444", bgColor: "rgba(239, 68, 68, 0.12)", animation: "none" },
};

export const ROLE_LABELS: Record<AgentRole, string> = {
  general: "일반",
  explorer: "탐색",
  planner: "기획",
  implementer: "구현",
  tester: "테스트",
  reviewer: "검토",
  deployer: "배포",
};
