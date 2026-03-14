// ── Vite Plugin: Agent Event Server ──────────────────────────────────────────
// Adds middleware to Vite dev server for agent monitoring SSE.
//
// Endpoints:
//   POST /__agents/event   — Push agent state update (JSON body)
//   POST /__agents/batch   — Push multiple events (JSON array body)
//   GET  /__agents/stream  — SSE stream (real-time updates)
//   GET  /__agents/state   — Current snapshot (JSON)
//   POST /__agents/reset   — Clear all agent state
//   POST /__agents/demo    — Spawn demo agents for testing
//
// Usage from agents (curl):
//   curl -X POST http://localhost:5174/__agents/event \
//     -H "Content-Type: application/json" \
//     -d '{"agentId":"a1","displayName":"Explorer","status":"reading","taskTitle":"Scan codebase"}'

import type { Plugin, ViteDevServer } from "vite";
import type { IncomingMessage, ServerResponse } from "http";

interface AgentEvent {
  id: string;
  agentId: string;
  type: string;
  message: string;
  timestamp: number;
  target?: string;
  severity?: string;
  meta?: Record<string, unknown>;
}

interface AgentState {
  agentId: string;
  displayName: string;
  role: string;
  status: string;
  taskTitle: string;
  currentTarget: string;
  progressPercent: number | null;
  startedAt: number;
  updatedAt: number;
  recentLog: string;
  errorSummary: string | null;
  events: AgentEvent[];
}

// ── In-memory store ──
const agents = new Map<string, AgentState>();
let sessionId = genId();
let sessionStartedAt = Date.now();
const sseClients = new Set<ServerResponse>();

const MAX_EVENTS_PER_AGENT = 100;
const MAX_BODY_SIZE = 64 * 1024; // 64KB
const MAX_AGENTS = 50;

// Fix #1: Module-scope interval handle for demo simulation
let demoInterval: ReturnType<typeof setInterval> | null = null;

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function getSnapshot() {
  return {
    agents: Array.from(agents.values()),
    sessionId,
    startedAt: sessionStartedAt,
    updatedAt: Date.now(),
  };
}

// Fix #4: Call d.end() before removing dead SSE clients
function broadcast(type: string, payload: unknown) {
  const data = JSON.stringify({ type, payload });
  const dead: ServerResponse[] = [];
  for (const client of sseClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      dead.push(client);
    }
  }
  for (const d of dead) {
    try { d.end(); } catch { /* already dead */ }
    sseClients.delete(d);
  }
}

// Fix #7: Evict oldest agents when over MAX_AGENTS
function enforceAgentCap() {
  if (agents.size <= MAX_AGENTS) return;

  const sorted = Array.from(agents.values()).sort((a, b) => a.updatedAt - b.updatedAt);

  // Evict done/failed first, then waiting, then oldest overall
  const evictPriority = (s: string) =>
    s === "done" || s === "failed" ? 0 : s === "waiting" ? 1 : 2;

  sorted.sort((a, b) => {
    const pa = evictPriority(a.status);
    const pb = evictPriority(b.status);
    if (pa !== pb) return pa - pb;
    return a.updatedAt - b.updatedAt;
  });

  while (agents.size > MAX_AGENTS && sorted.length > 0) {
    const victim = sorted.shift()!;
    agents.delete(victim.agentId);
  }
}

function processEvent(ev: Record<string, unknown>) {
  const agentId = ev.agentId as string;
  if (!agentId) return;

  const now = Date.now();
  let agent = agents.get(agentId);

  if (!agent) {
    agent = {
      agentId,
      displayName: (ev.displayName as string) || agentId,
      role: (ev.role as string) || "general",
      status: (ev.status as string) || "queued",
      taskTitle: (ev.taskTitle as string) || "",
      currentTarget: (ev.currentTarget as string) || "",
      progressPercent: ev.progressPercent != null ? (ev.progressPercent as number) : null,
      startedAt: now,
      updatedAt: now,
      recentLog: (ev.recentLog as string) || "",
      errorSummary: (ev.errorSummary as string) || null,
      events: [],
    };
    agents.set(agentId, agent);
    enforceAgentCap(); // Fix #7
  } else {
    if (ev.displayName != null) agent.displayName = ev.displayName as string;
    if (ev.role != null) agent.role = ev.role as string;
    if (ev.status != null) agent.status = ev.status as string;
    if (ev.taskTitle != null) agent.taskTitle = ev.taskTitle as string;
    if (ev.currentTarget != null) agent.currentTarget = ev.currentTarget as string;
    if (ev.progressPercent !== undefined) agent.progressPercent = ev.progressPercent as number | null;
    if (ev.recentLog != null) agent.recentLog = ev.recentLog as string;
    if (ev.errorSummary !== undefined) agent.errorSummary = ev.errorSummary as string | null;
    agent.updatedAt = now;
  }

  // Add event entry if eventType is provided
  if (ev.eventType) {
    const event: AgentEvent = {
      id: genId(),
      agentId,
      type: ev.eventType as string,
      message: (ev.eventMessage as string) || (ev.recentLog as string) || "",
      timestamp: now,
      target: (ev.eventTarget as string) || (ev.currentTarget as string) || undefined,
      severity: (ev.severity as string) || "info",
    };
    agent.events.push(event);
    if (agent.events.length > MAX_EVENTS_PER_AGENT) {
      agent.events = agent.events.slice(-MAX_EVENTS_PER_AGENT);
    }
    // Fix #6: Only broadcast agent_update (includes events array).
    // Do NOT broadcast agent_event separately — client handles agent_update
    // by replacing the entire agent state which already contains the new event.
  }

  broadcast("agent_update", agent);
}

// Fix #1: Clear any existing demo interval
function clearDemoInterval() {
  if (demoInterval !== null) {
    clearInterval(demoInterval);
    demoInterval = null;
  }
}

// ── Demo agent generation ──
function spawnDemoAgents() {
  clearDemoInterval(); // Fix #1: clean up previous interval
  agents.clear();
  sessionId = genId();
  sessionStartedAt = Date.now();

  const demos: Array<{ id: string; name: string; role: string; status: string; task: string; target: string; progress: number | null }> = [
    { id: "agent-explore-1", name: "Explorer", role: "explorer", status: "reading", task: "Scan frontend structure", target: "src/dev_app/", progress: 45 },
    { id: "agent-impl-1", name: "Implementer A", role: "implementer", status: "coding", task: "Add SSE transport layer", target: "vite-plugins/agentEventServer.ts", progress: 72 },
    { id: "agent-impl-2", name: "Implementer B", role: "implementer", status: "coding", task: "Build dashboard UI", target: "src/dev_app/pages/AgentMonitorPage.tsx", progress: 38 },
    { id: "agent-test-1", name: "Tester", role: "tester", status: "testing", task: "Run integration tests", target: "npm run test", progress: 60 },
    { id: "agent-review-1", name: "Reviewer", role: "reviewer", status: "reviewing", task: "Code review PR #142", target: "src/features/auth/", progress: null },
    { id: "agent-plan-1", name: "Planner", role: "planner", status: "planning", task: "Design data migration", target: "backend/apps/core/migrations/", progress: 20 },
    { id: "agent-deploy-1", name: "Deployer", role: "deployer", status: "waiting", task: "Wait for CI green", target: ".github/workflows/", progress: null },
    { id: "agent-blocked-1", name: "Worker X", role: "general", status: "blocked", task: "Fix tenant isolation bug", target: "backend/apps/core/middleware.py", progress: null },
  ];

  const eventTemplates: Array<{ type: string; msg: string }> = [
    { type: "spawned", msg: "Agent spawned" },
    { type: "assigned", msg: "Task assigned" },
    { type: "reading_file", msg: "Reading target files" },
  ];

  const now = Date.now();
  for (const d of demos) {
    const events: AgentEvent[] = eventTemplates.map((et, i) => ({
      id: genId(),
      agentId: d.id,
      type: et.type,
      message: et.msg,
      timestamp: now - (eventTemplates.length - i) * 5000,
      severity: "info",
    }));

    if (d.status === "blocked") {
      events.push({
        id: genId(),
        agentId: d.id,
        type: "blocked",
        message: "Blocked: waiting for dependency resolution",
        timestamp: now - 2000,
        severity: "error",
      });
    }

    agents.set(d.id, {
      agentId: d.id,
      displayName: d.name,
      role: d.role,
      status: d.status,
      taskTitle: d.task,
      currentTarget: d.target,
      progressPercent: d.progress,
      startedAt: now - 120000 - Math.random() * 300000,
      updatedAt: now - Math.random() * 10000,
      recentLog: `[${d.name}] Working on: ${d.task}`,
      errorSummary: d.status === "blocked" ? "Dependency not available" : d.status === "failed" ? "Process exited with code 1" : null,
      events,
    });
  }

  broadcast("snapshot", getSnapshot());

  // Simulate live updates
  let tick = 0;
  demoInterval = setInterval(() => {
    tick++;
    const agentList = Array.from(agents.values());
    if (agentList.length === 0) { clearDemoInterval(); return; }

    const agent = agentList[tick % agentList.length];
    const progressStates = ["reading", "coding", "testing", "planning", "reviewing"];
    if (progressStates.includes(agent.status) && agent.progressPercent != null) {
      agent.progressPercent = Math.min(100, agent.progressPercent + Math.floor(Math.random() * 8));
      agent.updatedAt = Date.now();
      if (agent.progressPercent >= 100) {
        agent.status = "done";
        agent.events.push({
          id: genId(),
          agentId: agent.agentId,
          type: "finished",
          message: "Task completed successfully",
          timestamp: Date.now(),
          severity: "info",
        });
      }
      broadcast("agent_update", agent);
    }

    if (tick > 60) clearDemoInterval(); // Fix #1: use centralized cleanup
  }, 3000);
}

// ── Request handler helpers ──
// Fix #2: Body size limit (64KB)
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE && !settled) {
        settled = true;
        req.destroy();
        reject(new Error("BODY_TOO_LARGE"));
        return;
      }
      if (!settled) chunks.push(chunk);
    });
    req.on("end", () => { if (!settled) { settled = true; resolve(Buffer.concat(chunks).toString()); } });
    req.on("error", (err) => { if (!settled) { settled = true; reject(err); } });
  });
}

function jsonResponse(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

// ── Vite Plugin ──
export default function agentEventServerPlugin(): Plugin {
  return {
    name: "agent-event-server",
    configureServer(server: ViteDevServer) {
      // Fix #5: SSE keepalive heartbeat every 15 seconds
      const heartbeatInterval = setInterval(() => {
        const dead: ServerResponse[] = [];
        for (const client of sseClients) {
          try {
            client.write(`: keepalive\n\n`);
          } catch {
            dead.push(client);
          }
        }
        for (const d of dead) {
          try { d.end(); } catch { /* already dead */ }
          sseClients.delete(d);
        }
      }, 15_000);
      // Clean up heartbeat when server closes
      server.httpServer?.on("close", () => {
        clearInterval(heartbeatInterval);
        clearDemoInterval();
      });

      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url || "";

        // CORS preflight
        if (req.method === "OPTIONS" && url.startsWith("/__agents/")) {
          res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          });
          res.end();
          return;
        }

        // SSE stream
        if (req.method === "GET" && url === "/__agents/stream") {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
          });
          // Send current snapshot immediately
          res.write(`data: ${JSON.stringify({ type: "snapshot", payload: getSnapshot() })}\n\n`);
          sseClients.add(res);
          req.on("close", () => sseClients.delete(res));
          return;
        }

        // Current state
        if (req.method === "GET" && url === "/__agents/state") {
          jsonResponse(res, 200, getSnapshot());
          return;
        }

        // Push single event
        // Fix #3: .catch() on readBody promise chains
        if (req.method === "POST" && url === "/__agents/event") {
          readBody(req).then((body) => {
            try {
              const ev = JSON.parse(body);
              processEvent(ev);
              jsonResponse(res, 200, { ok: true });
            } catch (e) {
              jsonResponse(res, 400, { error: "Invalid JSON" });
            }
          }).catch((err) => {
            if (err?.message === "BODY_TOO_LARGE") {
              jsonResponse(res, 413, { error: "Body too large (max 64KB)" });
            } else {
              jsonResponse(res, 500, { error: "Failed to read request body" });
            }
          });
          return;
        }

        // Push batch events
        if (req.method === "POST" && url === "/__agents/batch") {
          readBody(req).then((body) => {
            try {
              const events = JSON.parse(body);
              if (Array.isArray(events)) {
                for (const ev of events) processEvent(ev);
              }
              jsonResponse(res, 200, { ok: true, count: Array.isArray(events) ? events.length : 0 });
            } catch {
              jsonResponse(res, 400, { error: "Invalid JSON" });
            }
          }).catch((err) => {
            if (err?.message === "BODY_TOO_LARGE") {
              jsonResponse(res, 413, { error: "Body too large (max 64KB)" });
            } else {
              jsonResponse(res, 500, { error: "Failed to read request body" });
            }
          });
          return;
        }

        // Reset
        if (req.method === "POST" && url === "/__agents/reset") {
          clearDemoInterval(); // Fix #1: clear demo interval on reset
          agents.clear();
          sessionId = genId();
          sessionStartedAt = Date.now();
          broadcast("snapshot", getSnapshot());
          jsonResponse(res, 200, { ok: true });
          return;
        }

        // Demo
        if (req.method === "POST" && url === "/__agents/demo") {
          spawnDemoAgents();
          jsonResponse(res, 200, { ok: true, agents: agents.size });
          return;
        }

        next();
      });

      // Fix #8: Remove hardcoded port
      console.log("\n  Agent Monitor endpoints registered (see Vite output for port)");
      console.log("    SSE stream:  /__agents/stream");
      console.log("    Push event:  POST /__agents/event");
      console.log("    State:       GET  /__agents/state");
      console.log("    Demo:        POST /__agents/demo\n");
    },
  };
}
