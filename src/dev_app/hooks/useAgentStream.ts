// ── SSE Hook: Real-time Agent Stream ─────────────────────────────────────────
// Connects to /__agents/stream and maintains live agent state.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentSnapshot, AgentState, SSEMessage } from "@/dev_app/types/agent";

const SSE_URL = "/__agents/stream";
const RECONNECT_BASE = 2000;
const RECONNECT_MAX = 30000;

export interface AgentStreamState {
  agents: Map<string, AgentState>;
  sessionId: string | null;
  sessionStartedAt: number | null;
  connected: boolean;
  lastUpdate: number;
}

export function useAgentStream() {
  const [state, setState] = useState<AgentStreamState>({
    agents: new Map(),
    sessionId: null,
    sessionStartedAt: null,
    connected: false,
    lastUpdate: 0,
  });

  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(RECONNECT_BASE);
  const isMounted = useRef(true);

  const connect = useCallback(() => {
    if (!isMounted.current) return;

    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource(SSE_URL);
    esRef.current = es;

    es.onopen = () => {
      reconnectDelay.current = RECONNECT_BASE; // reset on successful connect
      setState((s) => ({ ...s, connected: true }));
    };

    es.onmessage = (event) => {
      try {
        const msg: SSEMessage = JSON.parse(event.data);
        const now = Date.now();

        setState((prev) => {
          switch (msg.type) {
            case "snapshot": {
              const snap = msg.payload as AgentSnapshot;
              const newMap = new Map<string, AgentState>();
              for (const a of snap.agents) {
                newMap.set(a.agentId, a);
              }
              return {
                ...prev,
                agents: newMap,
                sessionId: snap.sessionId,
                sessionStartedAt: snap.startedAt,
                lastUpdate: now,
              };
            }
            case "agent_update": {
              const incoming = msg.payload as AgentState;
              const newMap = new Map(prev.agents);
              // Server sends full agent state including events — trust it as authoritative
              newMap.set(incoming.agentId, incoming);
              return { ...prev, agents: newMap, lastUpdate: now };
            }
            case "agent_remove": {
              const { agentId } = msg.payload as { agentId: string };
              const newMap = new Map(prev.agents);
              newMap.delete(agentId);
              return { ...prev, agents: newMap, lastUpdate: now };
            }
            default:
              return prev;
          }
        });
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setState((s) => ({ ...s, connected: false }));
      const delay = reconnectDelay.current;
      reconnectDelay.current = Math.min(delay * 2, RECONNECT_MAX);
      reconnectTimer.current = setTimeout(connect, delay);
    };
  }, []);

  useEffect(() => {
    isMounted.current = true;
    connect();
    return () => {
      isMounted.current = false;
      if (esRef.current) esRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  // Memoize agentList
  const agentList = useMemo(() => Array.from(state.agents.values()), [state.agents]);

  // Helper actions
  const pushEvent = useCallback(async (event: Record<string, unknown>) => {
    await fetch("/__agents/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }).catch(() => {});
  }, []);

  const resetSession = useCallback(async () => {
    await fetch("/__agents/reset", { method: "POST" }).catch(() => {});
  }, []);

  const loadDemo = useCallback(async () => {
    await fetch("/__agents/demo", { method: "POST" }).catch(() => {});
  }, []);

  return {
    ...state,
    agentList,
    pushEvent,
    resetSession,
    loadDemo,
  };
}
