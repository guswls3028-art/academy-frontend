import {
  getSessionItem,
  removeSessionItem,
  setSessionItem,
} from "@/shared/utils/safeSessionStorage";

const WINDOW_NAME_PREFIX = "hplus-student-support:v1:";
const MODE_KEY = "hplus_student_support_mode";
const ACCESS_KEY = "hplus_student_support_access";
const INFO_KEY = "hplus_student_support_info";

export type StudentSupportSessionInfo = {
  studentId: number;
  studentName: string;
  expiresAt: string;
  sessionId: string;
};

type BootstrapPayload = StudentSupportSessionInfo & { access: string };

export function serializeStudentSupportWindowName(payload: BootstrapPayload): string {
  return `${WINDOW_NAME_PREFIX}${JSON.stringify(payload)}`;
}

export function bootstrapStudentSupportSession(): void {
  if (typeof window === "undefined" || !window.name.startsWith(WINDOW_NAME_PREFIX)) return;
  const raw = window.name.slice(WINDOW_NAME_PREFIX.length);
  window.name = "";
  try {
    const parsed = JSON.parse(raw) as Partial<BootstrapPayload>;
    const studentId = Number(parsed.studentId);
    const access = String(parsed.access || "").trim();
    if (!Number.isFinite(studentId) || studentId <= 0 || !access) return;
    const info: StudentSupportSessionInfo = {
      studentId,
      studentName: String(parsed.studentName || "학생"),
      expiresAt: String(parsed.expiresAt || ""),
      sessionId: String(parsed.sessionId || ""),
    };
    setSessionItem(MODE_KEY, "active");
    setSessionItem(ACCESS_KEY, access);
    setSessionItem(INFO_KEY, JSON.stringify(info));
  } catch {
    removeSessionItem(MODE_KEY);
    removeSessionItem(ACCESS_KEY);
    removeSessionItem(INFO_KEY);
  }
}

export function isStudentSupportWindow(): boolean {
  return getSessionItem(MODE_KEY) != null;
}

export function getStudentSupportAccessToken(): string | null {
  if (!isStudentSupportWindow()) return null;
  return getSessionItem(ACCESS_KEY);
}

export function getStudentSupportSessionInfo(): StudentSupportSessionInfo | null {
  if (!isStudentSupportWindow()) return null;
  try {
    const parsed = JSON.parse(getSessionItem(INFO_KEY) || "null") as StudentSupportSessionInfo | null;
    return parsed?.studentId ? parsed : null;
  } catch {
    return null;
  }
}

export function endStudentSupportSession(): void {
  removeSessionItem(ACCESS_KEY);
  removeSessionItem(INFO_KEY);
  setSessionItem(MODE_KEY, "ended");
}

export function closeStudentSupportWindow(): void {
  endStudentSupportSession();
  window.close();
  window.setTimeout(() => {
    if (!window.closed) window.location.replace("/support-preview-ended");
  }, 50);
}
