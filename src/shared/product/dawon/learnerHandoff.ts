import { getSessionItem } from "@/shared/utils/safeSessionStorage";
import { parseSchoolReportPeriod, studentSchoolReportPath } from "@/shared/product/schoolReports/period";

export const learnerHandoffKey = "dawon-learner-handoff";
export type LearnerRole = "student" | "guardian";

export function dawonLearnerTarget(pathname: string, search: string): LearnerRole | null {
  const query = new URLSearchParams(search);
  if (/^\/student\/exams\/[1-9]\d{0,9}\/result$/.test(pathname) && ["home", "menu", "day"].includes(query.get("from") ?? "")) {
    return query.get("preview") === "guardian" ? "guardian" : "student";
  }
  if (pathname === "/student/clinic" && query.get("from") === "menu") return "student";
  if (pathname === studentSchoolReportPath && query.get("from") === "terms" && !query.has("preview")) {
    if (query.size === 1 || parseSchoolReportPeriod(Object.fromEntries(query))) return "student";
  }
  if (pathname === "/student/community" && query.get("tab") === "counsel" &&
      ["form", "history"].includes(query.get("panel") ?? "")) return "guardian";
  return null;
}

export function hasDawonLearnerHandoff(pathname: string, search: string, role: LearnerRole) {
  if (window.location.hostname !== "demo.hakwonplus.com" || dawonLearnerTarget(pathname, search) !== role) return false;
  try {
    const intent = JSON.parse(getSessionItem(learnerHandoffKey) ?? "null");
    return intent?.role === role && intent.path === pathname + search &&
      Number.isFinite(intent.at) && intent.at <= Date.now() && Date.now() - intent.at < 120_000;
  } catch {
    return false;
  }
}
