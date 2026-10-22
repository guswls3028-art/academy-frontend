import { ADMIN_WORKFLOWS } from "@/shared/ui/guide/content/adminWorkflows";
import { STUDENT_WORKFLOWS } from "@/shared/ui/guide/content/studentWorkflows";
import { TEACHER_WORKFLOWS } from "@/shared/ui/guide/content/teacherWorkflows";

export const GUIDES = {
  admin: { label: "관리자·선생님", articles: ADMIN_WORKFLOWS },
  teacher: { label: "직원·강사", articles: TEACHER_WORKFLOWS },
  student: { label: "학생", articles: STUDENT_WORKFLOWS },
} as const;

export type GuideRole = keyof typeof GUIDES;
export const GUIDE_ROLES: GuideRole[] = ["admin", "teacher", "student"];

export function getGuideInquiryContext(params: URLSearchParams) {
  const role = GUIDE_ROLES.find((item) => item === params.get("guideRole"));
  if (!role) return undefined;
  const guide = GUIDES[role];
  const article = guide.articles.find((item) => item.id === params.get("guideTopic"));
  if (!article) return undefined;
  return {
    label: `${guide.label} · ${article.title}`,
    path: `/promo/guide?role=${role}&topic=${encodeURIComponent(article.id)}`,
  };
}
