// PATH: src/app_admin/domains/videos/utils/videoFormat.ts

function formatHms(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatVideoBytes(bytes?: number): string {
  return bytes ? `${(Number(bytes) / 1024 / 1024).toFixed(1)} MB` : "\u2014";
}

export function formatVideoDuration(duration?: string | number | null): string | null {
  if (!duration) return null;
  const seconds = typeof duration === "string" ? parseInt(duration, 10) : duration;
  if (Number.isNaN(seconds) || seconds <= 0) return null;
  return formatHms(seconds);
}

export function formatRoundedVideoDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  return formatHms(Math.round(seconds));
}
