import { useNavigate } from "react-router-dom";
import { ICON } from "@/shared/ui/ds";
import { Card, SectionTitle } from "@teacher/shared/ui/Card";
import {
  BookOpen,
  ChevronRight,
  ClipboardList,
  Monitor,
  Send,
  Users,
} from "@teacher/shared/ui/Icons";
import styles from "./TeacherGuidePage.module.css";

const GUIDE_ITEMS = [
  {
    title: "오늘 할 일 보기",
    description: "대시보드에서 오늘 수업, 출결 입력률, 답변 대기와 알림톡 업무를 먼저 확인합니다.",
    path: "/teacher",
    action: "대시보드",
    icon: <ClipboardList size={ICON.md} />,
  },
  {
    title: "학생 등록과 연락",
    description: "학생 탭에서 학생을 추가하고, 필요한 학생을 선택해 바로 알림톡을 보낼 수 있습니다.",
    path: "/teacher/students",
    action: "학생 탭",
    icon: <Users size={ICON.md} />,
  },
  {
    title: "강의와 출결 관리",
    description: "강의 탭에서 수업 일정을 확인하고, 차시별 출결과 성적 입력으로 이어갑니다.",
    path: "/teacher/classes",
    action: "강의 탭",
    icon: <BookOpen size={ICON.md} />,
  },
  {
    title: "알림톡 흐름",
    description: "학생 선택 발송은 학생 탭에서, 발송 결과와 템플릿은 메뉴의 발송 내역에서 확인합니다.",
    path: "/teacher/message-log",
    action: "발송 내역",
    icon: <Send size={ICON.md} />,
  },
  {
    title: "PC에서 처리할 일",
    description: "복잡한 시험·자료·설정 작업은 데스크톱 버전이나 PC 전용 기능 안내에서 확인하세요.",
    path: "/teacher/desktop-only",
    action: "PC 기능",
    icon: <Monitor size={ICON.md} />,
  },
];

export default function TeacherGuidePage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <p className={styles.eyebrow}>처음 사용하는 선생님을 위한 흐름</p>
        <h1 className={styles.title}>오늘 화면부터 차근차근 시작하세요.</h1>
        <p className={styles.description}>
          모바일에서는 빠른 확인과 현장 처리를 먼저 하고, 큰 설정은 데스크톱에서 마무리하는 흐름이 가장 편합니다.
        </p>
      </div>

      <SectionTitle>먼저 볼 순서</SectionTitle>
      <div className={styles.list}>
        {GUIDE_ITEMS.map((item) => (
          <Card key={item.path} className={styles.item} onClick={() => navigate(item.path)}>
            <span className={styles.itemIcon} aria-hidden>
              {item.icon}
            </span>
            <span className={styles.itemCopy}>
              <strong>{item.title}</strong>
              <span>{item.description}</span>
            </span>
            <span className={styles.itemAction}>
              {item.action}
              <ChevronRight size={ICON.sm} aria-hidden />
            </span>
          </Card>
        ))}
      </div>
    </div>
  );
}
