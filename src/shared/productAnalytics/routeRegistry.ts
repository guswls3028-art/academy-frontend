import { canonicalizeWorkspacePath } from "@/core/router/workspaceRoutes";
import type { ProductRoute } from "./types";

type CompiledRoute = ProductRoute & { matcher: RegExp };

function route(
  routeTemplate: string,
  featureId: string,
  screenId: string,
  surface: ProductRoute["surface"],
): CompiledRoute {
  const hasWildcard = routeTemplate.endsWith("/*");
  const templateBase = hasWildcard ? routeTemplate.slice(0, -2) : routeTemplate;
  const escaped = templateBase
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/:[a-zA-Z][a-zA-Z0-9]*/g, "[^/]+");
  return {
    routeTemplate,
    featureId,
    screenId,
    surface,
    matcher: new RegExp(`^${escaped}${hasWildcard ? "(?:/.*)?" : ""}/?$`),
  };
}

const ROUTES: CompiledRoute[] = [
  route("/workspace/dashboard", "dashboard.home", "admin.dashboard.home", "admin"),
  route("/workspace/students/*", "students.directory", "admin.students.workspace", "admin"),
  route("/workspace/lectures/:lectureId/sessions/:sessionId/attendance", "attendance.manage", "admin.attendance.session", "admin"),
  route("/workspace/lectures/:lectureId/sessions/:sessionId/scores", "scores.manage", "admin.scores.session", "admin"),
  route("/workspace/lectures/:lectureId/sessions/:sessionId/exams", "exams.manage", "admin.exams.session", "admin"),
  route("/workspace/lectures/:lectureId/sessions/:sessionId/assignments", "assignments.manage", "admin.assignments.session", "admin"),
  route("/workspace/lectures/:lectureId/sessions/:sessionId/notice", "community.manage", "admin.community.session", "admin"),
  route("/workspace/lectures/:lectureId/sessions/:sessionId/videos/*", "videos.manage", "admin.videos.session", "admin"),
  route("/workspace/lectures/:lectureId/sessions/:sessionId/clinic", "clinic.manage", "admin.clinic.session", "admin"),
  route("/workspace/lectures/*", "classes.manage", "admin.classes.workspace", "admin"),
  route("/workspace/materials/*", "materials.manage", "admin.materials.workspace", "admin"),
  route("/workspace/storage/*", "storage.manage", "admin.storage.workspace", "admin"),
  route("/workspace/fees/*", "fees.manage", "admin.fees.workspace", "admin"),
  route("/workspace/clinic/*", "clinic.manage", "admin.clinic.workspace", "admin"),
  route("/workspace/exams/*", "exams.manage", "admin.exams.workspace", "admin"),
  route("/workspace/results/*", "results.view", "admin.results.workspace", "admin"),
  route("/workspace/videos/*", "videos.manage", "admin.videos.workspace", "admin"),
  route("/workspace/counsel", "counseling.manage", "admin.counseling.home", "admin"),
  route("/workspace/message/*", "messaging.manage", "admin.messaging.workspace", "admin"),
  route("/workspace/community/*", "community.manage", "admin.community.workspace", "admin"),
  route("/workspace/landing-public/*", "landing.manage", "admin.landing.inbox", "admin"),
  route("/workspace/tools/*", "tools.use", "admin.tools.workspace", "admin"),
  route("/workspace/guide", "guide.view", "admin.guide.home", "admin"),
  route("/workspace/staff/*", "staff.manage", "admin.staff.workspace", "admin"),
  route("/workspace/settings/*", "settings.manage", "admin.settings.workspace", "admin"),
  route("/workspace/profile/*", "profile.manage", "admin.profile.workspace", "admin"),

  route("/workspace/mobile", "dashboard.home", "teacher.today.home", "teacher"),
  route("/workspace/mobile/guide", "guide.view", "teacher.guide.home", "teacher"),
  route("/workspace/mobile/classes/*", "classes.manage", "teacher.classes.workspace", "teacher"),
  route("/workspace/mobile/attendance/:sessionId", "attendance.manage", "teacher.attendance.session", "teacher"),
  route("/workspace/mobile/scores/:sessionId", "scores.manage", "teacher.scores.session", "teacher"),
  route("/workspace/mobile/students/*", "students.directory", "teacher.students.workspace", "teacher"),
  route("/workspace/mobile/comms", "messaging.manage", "teacher.messaging.home", "teacher"),
  route("/workspace/mobile/message-log", "messaging.manage", "teacher.messaging.log", "teacher"),
  route("/workspace/mobile/message-templates", "messaging.manage", "teacher.messaging.templates", "teacher"),
  route("/workspace/mobile/messaging-settings", "messaging.manage", "teacher.messaging.settings", "teacher"),
  route("/workspace/mobile/notifications", "messaging.manage", "teacher.notifications.home", "teacher"),
  route("/workspace/mobile/exams/*", "exams.manage", "teacher.exams.workspace", "teacher"),
  route("/workspace/mobile/homeworks/*", "assignments.manage", "teacher.assignments.workspace", "teacher"),
  route("/workspace/mobile/videos/*", "videos.manage", "teacher.videos.workspace", "teacher"),
  route("/workspace/mobile/clinic/*", "clinic.manage", "teacher.clinic.workspace", "teacher"),
  route("/workspace/mobile/counseling", "counseling.manage", "teacher.counseling.home", "teacher"),
  route("/workspace/mobile/results", "results.view", "teacher.results.home", "teacher"),
  route("/workspace/mobile/submissions", "assignments.manage", "teacher.submissions.home", "teacher"),
  route("/workspace/mobile/profile", "profile.manage", "teacher.profile.home", "teacher"),
  route("/workspace/mobile/settings/*", "settings.manage", "teacher.settings.workspace", "teacher"),
  route("/workspace/mobile/staff/*", "staff.manage", "teacher.staff.workspace", "teacher"),
  route("/workspace/mobile/my-records", "profile.manage", "teacher.records.home", "teacher"),
  route("/workspace/mobile/billing", "fees.manage", "teacher.billing.home", "teacher"),
  route("/workspace/mobile/fees/*", "fees.manage", "teacher.fees.workspace", "teacher"),
  route("/workspace/mobile/storage/*", "storage.manage", "teacher.storage.workspace", "teacher"),
  route("/workspace/mobile/tools/*", "tools.use", "teacher.tools.workspace", "teacher"),

  route("/student/dashboard", "dashboard.home", "student.dashboard.home", "student"),
  route("/student/video/*", "videos.manage", "student.videos.workspace", "student"),
  route("/student/sessions/*", "classes.manage", "student.classes.workspace", "student"),
  route("/student/submit/*", "assignments.manage", "student.submissions.workspace", "student"),
  route("/student/inventory", "storage.manage", "student.inventory.home", "student"),
  route("/student/exams/*", "exams.manage", "student.exams.workspace", "student"),
  route("/student/grades/*", "scores.manage", "student.grades.workspace", "student"),
  route("/student/profile", "profile.manage", "student.profile.home", "student"),
  route("/student/settings", "settings.manage", "student.settings.home", "student"),
  route("/student/community", "community.manage", "student.community.home", "student"),
  route("/student/qna", "community.manage", "student.community.qna", "student"),
  route("/student/notices/*", "community.manage", "student.notices.workspace", "student"),
  route("/student/notifications", "messaging.manage", "student.notifications.home", "student"),
  route("/student/idcard", "clinic.manage", "student.clinic.idcard", "student"),
  route("/student/clinic", "clinic.manage", "student.clinic.home", "student"),
  route("/student/attendance", "attendance.manage", "student.attendance.home", "student"),
  route("/student/fees", "fees.manage", "student.fees.home", "student"),
  route("/student/guide", "guide.view", "student.guide.home", "student"),
];

function publicRoute(candidate: CompiledRoute): ProductRoute {
  return {
    routeTemplate: candidate.routeTemplate,
    featureId: candidate.featureId,
    screenId: candidate.screenId,
    surface: candidate.surface,
  };
}

export function resolveProductRoute(pathname: string): ProductRoute | null {
  const canonicalPathname = canonicalizeWorkspacePath(pathname) ?? pathname;
  const match = ROUTES.find((candidate) =>
    candidate.matcher.test(canonicalPathname),
  );
  return match ? publicRoute(match) : null;
}

export const PRODUCT_ROUTES: ProductRoute[] = ROUTES.map(publicRoute);
