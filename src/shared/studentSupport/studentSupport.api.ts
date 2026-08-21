import api from "@/shared/api/axios";
import { serializeStudentSupportWindowName } from "@/shared/auth/supportPreviewSession";

export type StudentActivityCategory =
  | "login"
  | "home"
  | "homework"
  | "video"
  | "exam"
  | "result"
  | "attendance"
  | "clinic"
  | "notice"
  | "profile"
  | "fee"
  | "guide";

export type StudentActivityItem = {
  id: number;
  occurred_at: string;
  category: StudentActivityCategory;
  label: string;
  actor_mode: "student" | "support";
  device_class: "mobile" | "tablet" | "desktop";
  screen_id: string;
};

export type StudentActivityFeed = {
  student: { id: number; name: string };
  results: StudentActivityItem[];
  count: number;
  days: 7 | 30 | 90;
  include_support: boolean;
};

type StudentSupportSession = {
  access: string;
  expires_at: string;
  session_id: string;
  student: { id: number; name: string };
};

export const studentSupportQueryKeys = {
  activities: (
    studentId: number,
    days: 7 | 30 | 90,
    category: StudentActivityCategory | "",
    includeSupport: boolean,
  ) => ["student-activities", studentId, days, category, includeSupport] as const,
};

let lastScreenRecord = { key: "", at: 0 };

function studentAuditScreenId(pathname: string): string | null {
  if (pathname === "/student/dashboard") return "student.dashboard.home";
  if (pathname === "/student/video/play") return "student.video.player";
  if (/^\/student\/video\/sessions\//.test(pathname)) return "student.video.session";
  if (pathname.startsWith("/student/video")) return "student.video.home";
  if (/^\/student\/sessions\/[^/]+/.test(pathname)) return "student.session.detail";
  if (pathname === "/student/sessions") return "student.session.list";
  if (pathname.startsWith("/student/submit")) return "student.assignment.submit";
  if (/^\/student\/exams\/[^/]+\/result/.test(pathname)) return "student.exam.result";
  if (/^\/student\/exams\/[^/]+\/submit/.test(pathname)) return "student.exam.submit";
  if (/^\/student\/exams\/[^/]+/.test(pathname)) return "student.exam.detail";
  if (pathname === "/student/exams") return "student.exam.list";
  if (pathname.startsWith("/student/grades")) return "student.grades.home";
  if (pathname === "/student/attendance") return "student.attendance.home";
  if (pathname === "/student/clinic") return "student.clinic.home";
  if (/^\/student\/(community|qna|notices|notifications)/.test(pathname)) return "student.notice.home";
  if (pathname === "/student/profile") return "student.profile.home";
  if (pathname === "/student/settings") return "student.settings.home";
  if (pathname === "/student/fees") return "student.fees.home";
  if (pathname === "/student/guide") return "student.guide.home";
  return null;
}

function currentDeviceClass(): "mobile" | "tablet" | "desktop" {
  if (window.innerWidth < 768) return "mobile";
  if (window.innerWidth < 1100) return "tablet";
  return "desktop";
}

export async function recordStudentScreenView(pathname: string): Promise<void> {
  const screenId = studentAuditScreenId(pathname);
  if (!screenId) return;
  const now = Date.now();
  const key = `${screenId}:${pathname}`;
  if (lastScreenRecord.key === key && now - lastScreenRecord.at < 1_500) return;
  lastScreenRecord = { key, at: now };
  try {
    await api.post(
      "/students/me/activity/",
      { screen_id: screenId, device_class: currentDeviceClass() },
      { timeout: 4_000 },
    );
  } catch {
    // Activity evidence must never block the student's screen.
  }
}

export async function openStudentSupportPreview(studentId: number): Promise<void> {
  const width = 430;
  const height = Math.min(820, Math.max(640, window.screen.availHeight - 80));
  const screenWithOrigin = window.screen as Screen & {
    availLeft?: number;
    availTop?: number;
  };
  const left = Math.max(
    0,
    (screenWithOrigin.availLeft ?? window.screenX) + window.screen.availWidth - width - 28,
  );
  const top = Math.max(0, (screenWithOrigin.availTop ?? window.screenY) + 28);
  const preview = window.open(
    "about:blank",
    "_blank",
    `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
  );
  if (!preview) {
    throw new Error("팝업이 차단되었습니다. 이 사이트의 팝업을 허용해 주세요.");
  }

  try {
    const response = await api.post<StudentSupportSession>(
      `/students/${studentId}/support-session/`,
      {},
    );
    const session = response.data;
    preview.name = serializeStudentSupportWindowName({
      access: session.access,
      studentId: session.student.id,
      studentName: session.student.name,
      expiresAt: session.expires_at,
      sessionId: session.session_id,
    });
    preview.location.replace("/student/dashboard?supportPreview=1");
    preview.focus();
  } catch (error) {
    preview.close();
    throw error;
  }
}

export async function fetchStudentActivities(
  studentId: number,
  params: {
    days: 7 | 30 | 90;
    category?: StudentActivityCategory | "";
    includeSupport: boolean;
  },
): Promise<StudentActivityFeed> {
  const response = await api.get<StudentActivityFeed>(
    `/students/${studentId}/activities/`,
    {
      params: {
        days: params.days,
        category: params.category || undefined,
        include_support: params.includeSupport ? 1 : 0,
        limit: 100,
      },
    },
  );
  return response.data;
}
