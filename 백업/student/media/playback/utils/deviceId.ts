// src/student/media/playback/utils/deviceId.ts

/**
 * device_id는 정책(기기 제한/동시접속)에서 매우 중요.
 * ✅ token/policy/progress 저장은 금지지만,
 * ✅ device_id는 "기기 식별자"라 저장 허용(장기 운영에 유리)
 */
const KEY = "device_id_v1";

function randomId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;

    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
    const id = `web:${ua.includes("Chrome") ? "chrome" : "browser"}:${randomId()}`;
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    // localStorage 불가 환경(사파리 프라이빗 등) → 메모리 대체
    return `web:volatile:${randomId()}`;
  }
}
