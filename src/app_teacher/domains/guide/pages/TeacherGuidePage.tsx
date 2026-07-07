import { useNavigate } from "react-router-dom";
import { ICON } from "@/shared/ui/ds";
import { Card, SectionTitle } from "@teacher/shared/ui/Card";
import {
  AlertCircle,
  BookOpen,
  CheckCircle,
  ChevronRight,
  ClipboardList,
  Monitor,
  Send,
  Users,
} from "@teacher/shared/ui/Icons";
import styles from "./TeacherGuidePage.module.css";

const GUIDE_ITEMS = [
  {
    title: "오늘 수업과 처리할 일 확인",
    description: "대시보드에서 오늘 수업, 출결 입력률, QnA 답변 대기, 알림톡 예약 업무를 먼저 봅니다.",
    path: "/teacher",
    action: "대시보드",
    icon: <ClipboardList size={ICON.md} />,
  },
  {
    title: "학생 찾기와 바로 연락",
    description: "학생 탭에서 이름으로 검색하고, 필요한 학생을 선택해 학부모 알림톡이나 상담 메모로 이어갑니다.",
    path: "/teacher/students",
    action: "학생 탭",
    icon: <Users size={ICON.md} />,
  },
  {
    title: "강의, 차시, 출결 처리",
    description: "강의 탭에서 오늘 차시를 열고 출결, 성적 입력, 제출 확인으로 이어갑니다.",
    path: "/teacher/classes",
    action: "강의 탭",
    icon: <BookOpen size={ICON.md} />,
  },
  {
    title: "알림톡 발송 결과 확인",
    description: "학생 선택 발송은 학생 탭에서 시작하고, 성공·실패 결과는 발송 내역에서 확인합니다.",
    path: "/teacher/message-log",
    action: "발송 내역",
    icon: <Send size={ICON.md} />,
  },
];

const DESKTOP_ITEMS = [
  {
    title: "시험지, 영상, 자료, 학원 설정",
    description: "대량 입력이나 파일 작업은 화면이 넓은 PC에서 처리하면 실수가 줄어듭니다.",
    path: "/teacher/desktop-only",
    action: "PC 기능",
    icon: <Monitor size={ICON.md} />,
  },
];

const QUICK_NOTES = [
  "학생이 안 보이면 강의 배정과 수강생 등록을 먼저 확인합니다.",
  "학부모 로그인은 아이디가 아니라 등록된 휴대폰 번호 기준입니다.",
  "알림톡은 발송 직후 발송 내역에서 성공·실패 상태를 확인합니다.",
];

export default function TeacherGuidePage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <p className={styles.eyebrow}>공식 선생님 가이드</p>
        <h1 className={styles.title}>수업 현장에서는 오늘 화면부터 시작하세요.</h1>
        <p className={styles.description}>
          모바일은 빠른 확인과 현장 처리를 위한 화면입니다. 큰 설정은 PC에서 끝내고,
          선생님은 수업, 학생, 알림톡, 제출 확인 순서로 쓰면 가장 편합니다.
        </p>
      </div>

      <div className={styles.startBox}>
        <CheckCircle size={ICON.md} aria-hidden />
        <div>
          <strong>처음 5분 목표</strong>
          <span>오늘 수업이 보이는지 확인하고, 학생 1명을 찾아 알림톡 발송 내역까지 확인합니다.</span>
        </div>
      </div>

      <SectionTitle>현장에서 먼저 볼 순서</SectionTitle>
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

      <SectionTitle>PC로 넘길 일</SectionTitle>
      <div className={styles.list}>
        {DESKTOP_ITEMS.map((item) => (
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

      <div className={styles.noteBox}>
        <div className={styles.noteTitle}>
          <AlertCircle size={ICON.sm} aria-hidden />
          처음 막히기 쉬운 부분
        </div>
        <ul>
          {QUICK_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
