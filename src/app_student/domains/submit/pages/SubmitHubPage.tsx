/**
 * 제출 허브 — 성적표 제출 / 과제 제출(동영상·사진) 선택
 */
import { Link } from "react-router";
import useAuth from "@/auth/hooks/useAuth";
import { studentSchoolReportPath } from "@/shared/product/schoolReports/period";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import { IconGrade, IconBoard, IconFolder, IconChevronRight } from "@student/shared/ui/icons/Icons";
import styles from "./SubmitHubPage.module.css";

const schoolReportLink = {
  to: studentSchoolReportPath,
  title: "학교 성적표 직접 입력",
  description: "학기와 시험을 선택해 학교 시험 점수를 제출합니다.",
  badge: "점수 입력",
  tone: "score",
  Icon: IconGrade,
};

const submitLinks = [
  {
    to: "/student/surveys",
    title: "설문과 응답",
    description: "선생님이 요청한 성적·시험 범위·설문에 답합니다.",
    badge: "응답 확인",
    tone: "score",
    Icon: IconBoard,
  },
  {
    to: "/student/submit/score",
    title: "성적표 파일 제출",
    description: "이미지·PDF로 성적표를 제출합니다.",
    badge: "PDF / 이미지",
    tone: "score",
    Icon: IconGrade,
  },
  {
    to: "/student/submit/assignment",
    title: "과제 제출",
    description: "동영상·사진을 제출하고 선생님 확인 결과를 확인합니다.",
    badge: "동영상 / 사진",
    tone: "assignment",
    Icon: IconBoard,
  },
  {
    to: "/student/inventory",
    title: "내 인벤토리",
    description: "제출한 파일을 확인하고 관리합니다.",
    badge: "자료함",
    tone: "inventory",
    Icon: IconFolder,
  },
];

export default function SubmitHubPage() {
  const { user } = useAuth();
  const links = user?.tenantRole === "parent" ? submitLinks : [schoolReportLink, ...submitLinks];
  return (
    <StudentPageShell
      title="제출"
      description="성적표나 과제 파일을 제출하고 학습 현황에서 결과를 확인하세요."
      descriptionMode="help"
    >
      <div className={styles.stack}>
{links.map(({ to, title, description, badge, tone, Icon }) => (
          <Link
            key={to}
            to={to}
            className={`stu-panel stu-panel--pressable stu-panel--accent stu-panel--nav ${styles.card}`}
            data-tone={tone}
          >
            <div className={styles.iconWrap}>
              <Icon className={styles.icon} />
            </div>
            <div className={styles.content}>
              <div className={styles.topline}>
                <div className={styles.title}>{title}</div>
                <span className={styles.badge}>{badge}</span>
              </div>
              <div className={`stu-muted ${styles.description}`}>{description}</div>
            </div>
            <IconChevronRight className={`stu-chevron ${styles.chevron}`} />
          </Link>
        ))}
      </div>
    </StudentPageShell>
  );
}
