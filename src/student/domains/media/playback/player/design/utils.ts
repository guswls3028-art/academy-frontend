// PATH: src/student/domains/media/playback/player/design/utils.ts
export function clamp(v: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function safeParseInt(v: any, fallback?: number): number | null {
  if (v == null) return fallback ?? null;
  const n = Number.parseInt(String(v), 10);
  if (Number.isNaN(n)) return fallback ?? null;
  return n;
}

export function safeParseFloat(v: any, fallback?: number): number | null {
  if (v == null) return fallback ?? null;
  const n = Number.parseFloat(String(v));
  if (Number.isNaN(n)) return fallback ?? null;
  return n;
}

export function formatClock(sec: number) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }
  return `${m}:${String(ss).padStart(2, "0")}`;
}

export function getEpochSec() {
  return Math.floor(Date.now() / 1000);
}

export function formatDateTimeKorean(ms: number) {
  if (!ms) return "-";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export function getOrCreateDeviceId() {
  const key = "student_device_id_v1";
  let v = "";
  try {
    v = String(localStorage.getItem(key) || "");
  } catch {
    v = "";
  }
  if (v && v.length >= 12) return v;

  const seed = Math.random().toString(16).slice(2);
  const now = Date.now().toString(16);
  v = `dev_${now}_${seed}`.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 42);

  try {
    localStorage.setItem(key, v);
  } catch {}

  return v;
}
