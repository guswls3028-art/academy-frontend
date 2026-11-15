import api from "@/shared/api/axios";

export type AgentState = "running" | "waiting" | "completed" | "interrupted" | "unknown";
export type AgentNode = {
  id: string;
  provider: "codex" | "claude";
  parent_id: string | null;
  title: string;
  role: string;
  status: AgentState;
  evidence: "runtime" | "last_turn" | "closed" | "unknown";
  updated_at: string | null;
};
export type AgentSnapshot = {
  schema: 1;
  collected_at: string | null;
  source_status: "connected" | "stale" | "unavailable";
  stale_after_seconds: number;
  nodes: AgentNode[];
  truncated: boolean;
  source_errors: Array<"codex" | "claude">;
};

export async function getAgentSessions(signal?: AbortSignal): Promise<AgentSnapshot> {
  const { data } = await api.get<AgentSnapshot>("/core/dev/agent-sessions/", { signal });
  if (data?.schema !== 1 || !Array.isArray(data.nodes) || !Array.isArray(data.source_errors)) throw new Error("Invalid session snapshot");
  return data;
}
