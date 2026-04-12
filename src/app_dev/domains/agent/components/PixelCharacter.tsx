// ── Pixel Art Characters for Agent Monitor ──────────────────────────────────
import { STATUS_META } from "@dev/domains/agent/types/agent";
import type { AgentStatus } from "@dev/domains/agent/types/agent";
import s from "./AgentDeskCard.module.css";

export function PixelCharacter({ status, role, size = 28 }: {
  status: AgentStatus;
  role: string;
  size?: number;
}) {
  const meta = STATUS_META[status] || STATUS_META.queued;
  const animClass =
    meta.animation === "typing" ? s.animTyping :
    meta.animation === "reading" ? s.animReading :
    meta.animation === "pulse" ? s.animPulse :
    meta.animation === "blink" ? s.animBlink :
    "";

  // Role-based body color
  const bodyColor =
    role === "explorer" ? "#3b82f6" :
    role === "implementer" ? "#10b981" :
    role === "tester" ? "#f59e0b" :
    role === "reviewer" ? "#8b5cf6" :
    role === "planner" ? "#ec4899" :
    role === "deployer" ? "#f97316" :
    "#64748b";

  // Status indicator dot color (shown top-right)
  const indicatorColor =
    status === "done" ? "#2dd4bf" :
    status === "failed" ? "#ef4444" :
    status === "blocked" ? "#f59e0b" :
    status === "coding" ? "#10b981" :
    status === "testing" ? "#f59e0b" :
    status === "deploying" ? "#f97316" :
    null;

  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={`${s.pixelChar} ${animClass}`}
      style={{ imageRendering: "pixelated" }}
    >
      {/* Head */}
      <rect x="5" y="1" width="6" height="5" fill="#fcd9b6" />
      {/* Eyes */}
      <rect x="6" y="3" width="1" height="1" fill="#334155" />
      <rect x="9" y="3" width="1" height="1" fill="#334155" />
      {/* Neck */}
      <rect x="6" y="5" width="4" height="1" fill={bodyColor} />
      {/* Body */}
      <rect x="4" y="6" width="8" height="6" fill={bodyColor} />
      {/* Legs */}
      <rect x="5" y="12" width="2" height="3" fill="#475569" />
      <rect x="9" y="12" width="2" height="3" fill="#475569" />
      {/* Status indicator dot */}
      {indicatorColor && (
        <rect x="13" y="1" width="3" height="3" fill={indicatorColor} />
      )}
    </svg>
  );
}

export function PixelDesk() {
  return (
    <svg viewBox="0 0 48 32" width={96} height={64} style={{ imageRendering: "pixelated", opacity: 0.3 }}>
      {/* Desk */}
      <rect x="4" y="16" width="40" height="3" rx="1" fill="#94a3b8" />
      <rect x="8" y="19" width="3" height="12" fill="#64748b" />
      <rect x="37" y="19" width="3" height="12" fill="#64748b" />
      {/* Monitor */}
      <rect x="14" y="6" width="20" height="10" rx="1" fill="#475569" />
      <rect x="15" y="7" width="18" height="8" rx="0.5" fill="#1e293b" />
      <rect x="22" y="16" width="4" height="2" fill="#64748b" />
      {/* Chair */}
      <rect x="18" y="22" width="12" height="3" rx="1" fill="#334155" />
      <rect x="22" y="25" width="4" height="6" fill="#334155" />
    </svg>
  );
}
