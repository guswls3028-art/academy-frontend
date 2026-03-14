// ── Agent Monitor: Shared Utilities ──────────────────────────────────────────

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function formatTime(ts: number): string {
  if (!ts || isNaN(ts)) return "\u2014";
  return new Date(ts).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function truncatePath(p: string): string {
  if (p.length <= 32) return p;
  const parts = p.split(/[/\\]/);
  if (parts.length <= 2) return "..." + p.slice(-29);
  return parts[0] + "/.../" + parts[parts.length - 1];
}
