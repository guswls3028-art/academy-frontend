import { getAccessToken } from "@/shared/api/axios";

export function dawonStaffPreviewRole(): "admin" | "teacher" | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const role = payload.dawon_demo_role;
    return payload.tenant_id === 719 && (role === "admin" || role === "teacher") ? role : null;
  } catch {
    return null;
  }
}

export function isDawonTeachingPath(path: string) {
  if (["/workspace/settings", "/workspace/settings/profile", "/workspace/settings/appearance", "/workspace/settings/organization"].includes(path)) return true;
  return /^\/workspace\/(dashboard|lectures|students|clinic|community|teacher-alerts|exams|results|videos|sessions|surveys|homework|submissions)(?:\/|$)/.test(path);
}
