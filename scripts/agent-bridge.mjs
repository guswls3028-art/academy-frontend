#!/usr/bin/env node
// ── Claude Code → Agent Monitor Bridge ───────────────────────────────────────
// Called by Claude Code hooks (async). Reads hook JSON from stdin, POSTs to
// the Agent Monitor SSE server running inside Vite dev server.
//
// No external dependencies — uses only Node.js built-ins.
// Configured in .claude/settings.local.json as hook handler.

import http from "node:http";

const MONITOR_HOST = process.env.AGENT_MONITOR_HOST || "localhost";
const MONITOR_PORT = parseInt(process.env.AGENT_MONITOR_PORT || "5174", 10);

// ── Read all stdin ──
function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => { clearTimeout(timer); resolve(chunks.join("")); });
    process.stdin.on("error", () => { clearTimeout(timer); resolve(""); });
    // If no stdin piped, resolve after timeout
    const timer = setTimeout(() => resolve(chunks.join("")), 2000);
  });
}

// ── POST JSON to monitor ──
function postEvent(data) {
  return new Promise((resolve) => {
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: MONITOR_HOST,
      port: MONITOR_PORT,
      path: "/__agents/event",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 3000,
    }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.write(body);
    req.end();
  });
}

function postReset() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: MONITOR_HOST,
      port: MONITOR_PORT,
      path: "/__agents/reset",
      method: "POST",
      timeout: 3000,
    }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.end();
  });
}

// ── Infer status from tool name ──
function inferStatusFromTool(toolName, toolInput) {
  switch (toolName) {
    case "Read":
    case "Glob":
    case "Grep":
      return { status: "reading", eventType: "reading_file" };
    case "Edit":
    case "Write":
    case "NotebookEdit":
      return { status: "coding", eventType: "editing_file" };
    case "Bash": {
      const cmd = toolInput?.command || "";
      if (/\b(test|jest|pytest|vitest|mocha|p?npm\s+test|p?npm\s+run\s+test|pnpm\s+test)\b/i.test(cmd)) {
        return { status: "testing", eventType: "running_tests" };
      }
      if (/\b(deploy|push|publish|docker)\b/i.test(cmd)) {
        return { status: "deploying", eventType: "running_command" };
      }
      return { status: "coding", eventType: "running_command" };
    }
    case "Agent":
      return { status: "planning", eventType: "status_change" };
    case "WebSearch":
    case "WebFetch":
      return { status: "reading", eventType: "reading_file" };
    case "Skill":
      return { status: "coding", eventType: "status_change" };
    default:
      return { status: "coding", eventType: "status_change" };
  }
}

// ── Extract target from tool input ──
function extractTarget(toolName, toolInput) {
  if (!toolInput) return "";
  switch (toolName) {
    case "Read":
    case "Edit":
    case "Write":
    case "NotebookEdit":
      return toolInput.file_path || "";
    case "Glob":
      return toolInput.pattern || "";
    case "Grep":
      return toolInput.pattern || "";
    case "Bash":
      return (toolInput.command || "").slice(0, 120);
    case "Agent":
      return (toolInput.prompt || "").slice(0, 80);
    case "WebSearch":
      return toolInput.query || "";
    case "WebFetch":
      return toolInput.url || "";
    default:
      return "";
  }
}

// ── Map agent_type to role ──
function mapRole(agentType) {
  if (!agentType || agentType === "main") return "general";
  const t = agentType.toLowerCase();
  if (t.includes("explore")) return "explorer";
  if (t.includes("plan")) return "planner";
  if (t.includes("test")) return "tester";
  if (t.includes("review")) return "reviewer";
  if (t.includes("deploy")) return "deployer";
  return "implementer";
}

// ── Main ──
async function main() {
  const raw = await readStdin();
  if (!raw.trim()) process.exit(0);

  let input;
  try {
    input = JSON.parse(raw);
  } catch (e) {
    console.error("[agent-bridge] JSON parse failed:", e.message);
    process.exit(0);
  }

  const hookEvent = input.hook_event_name || "";
  const agentId = input.agent_id || "main";
  const agentType = input.agent_type || "main";
  const toolName = input.tool_name || "";
  const toolInput = input.tool_input || {};

  switch (hookEvent) {
    case "SubagentStart": {
      await postEvent({
        agentId,
        displayName: `${agentType} (${agentId.slice(0, 8)})`,
        role: mapRole(agentType),
        status: "planning",
        taskTitle: "Starting...",
        eventType: "spawned",
        eventMessage: `Agent spawned: ${agentType}`,
      });
      break;
    }

    case "SubagentStop": {
      await postEvent({
        agentId,
        status: "done",
        eventType: "finished",
        eventMessage: "Agent completed",
      });
      break;
    }

    case "PreToolUse": {
      const { status, eventType } = inferStatusFromTool(toolName, toolInput);
      const target = extractTarget(toolName, toolInput);
      const logMsg = target ? `${toolName}: ${target}` : toolName;

      await postEvent({
        agentId,
        status,
        currentTarget: target,
        recentLog: logMsg,
        eventType,
        eventMessage: logMsg,
        eventTarget: target,
      });
      break;
    }

    case "PostToolUse": {
      const target = extractTarget(toolName, toolInput);
      await postEvent({
        agentId,
        recentLog: `${toolName} completed`,
        eventType: "log",
        eventMessage: `${toolName} completed`,
        eventTarget: target,
      });
      break;
    }

    case "PostToolUseFailure": {
      const error = String(input.error || "Unknown error").slice(0, 200);
      await postEvent({
        agentId,
        status: "blocked",
        errorSummary: error,
        recentLog: `${toolName} failed: ${error}`,
        eventType: "failed",
        eventMessage: `${toolName} failed`,
        severity: "error",
      });
      break;
    }

    case "SessionStart": {
      await postReset();
      await postEvent({
        agentId: "main",
        displayName: "Main Agent",
        role: "general",
        status: "planning",
        taskTitle: "Session started",
        eventType: "spawned",
        eventMessage: "Session started",
      });
      break;
    }

    case "Stop": {
      await postEvent({
        agentId,
        status: "waiting",
        recentLog: "Waiting for next prompt",
        eventType: "log",
        eventMessage: "Response complete",
      });
      break;
    }

    default:
      break;
  }
}

main().catch((e) => { console.error("[agent-bridge] Hook failed:", e.message); process.exit(0); });
