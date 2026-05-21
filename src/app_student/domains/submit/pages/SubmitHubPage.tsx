/**
 * 제출 허브 — 성적표 제출 / 과제 제출(동영상·사진) 선택
 */
import { Link } from "react-router-dom";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import { IconGrade, IconBoard, IconFolder, IconChevronRight } from "@student/shared/ui/icons/Icons";
import styles from "./SubmitHubPage.module.css";

const submitLinks = [
  {
    to: "/student/submit/score",
    title: "성적표 제출",
    description: "이미지·PDF로 성적표를 제출합니다.",
    Icon: IconGrade,
  },
  {
    to: "/student/submit/assignment",
    title: "과제 제출",
    description: "동영상·사진으로 과제를 제출합니다.",
    Icon: IconBoard,
  },
  {
    to: "/student/inventory",
    title: "내 인벤토리",
    description: "제출한 파일을 확인하고 관리합니다.",
    Icon: IconFolder,
  },
];

export default function SubmitHubPage() {
  return (
    <StudentPageShell
      title="제출"
      description="성적표 또는 과제(동영상·사진)를 제출하면 선생님 인벤토리에 저장됩니다."
    >
      <div className={styles.stack}>
        {submitLinks.map(({ to, title, description, Icon }) => (
          <Link
            key={to}
            to={to}
            className={`stu-panel stu-panel--pressable stu-panel--accent stu-panel--nav ${styles.card}`}
          >
            <div className={styles.iconWrap}>
              <Icon className={styles.icon} />
            </div>
            <div className={styles.content}>
              <div className={styles.title}>{title}</div>
              <div className={`stu-muted ${styles.description}`}>{description}</div>
            </div>
            <IconChevronRight className={`stu-chevron ${styles.chevron}`} />
          </Link>
        ))}
      </div>
    </StudentPageShell>
  );
}
