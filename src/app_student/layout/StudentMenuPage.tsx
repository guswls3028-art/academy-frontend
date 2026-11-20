import { Link } from "react-router";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import { IconChevronRight } from "@student/shared/ui/icons/Icons";
import { useWrongCompletionDisplay } from "@/shared/scoring/assessmentStatusDisplay";
import { STUDENT_NAV_GROUPS } from "./studentNavigation";
import styles from "./StudentMenuPage.module.css";

const descriptions: Record<string, string> = {
  "/student/video": "수업 영상을 찾아 이어서 학습해요.",
  "/student/grades": "시험과 과제 결과, 남은 학습을 확인해요.",
  "/student/exams": "응시할 시험과 제출 상태를 확인해요.",
  "/student/submit/assignment": "과제를 제출하고 처리 상태를 확인해요.",
  "/student/clinic": "클리닉을 예약하고 일정을 확인해요.",
  "/student/idcard": "선생님께 보여 드릴 학습 상태를 열어요.",
  "/student/sessions": "수업 일정과 차시별 안내를 확인해요.",
  "/student/notices": "학원에서 보낸 공지를 읽어요.",
  "/student/community": "질문·상담과 선생님의 답변을 확인해요.",
  "/student/community?tab=board": "학원 게시글을 읽어요.",
  "/student/community?tab=materials": "수업에 필요한 자료를 받아요.",
  "/student/attendance": "내 출결 기록을 확인해요.",
  "/student/submit": "제출할 자료의 종류를 선택해요.",
  "/student/inventory": "보관한 파일과 자료를 찾아요.",
  "/student/notifications": "새 답변과 학습 안내를 모아 봐요.",
  "/student/profile": "내 계정 정보를 확인해요.",
  "/student/settings": "화면과 알림 등 앱 사용 환경을 설정해요.",
  "/student/guide": "사용 순서와 화면별 안내를 읽어요.",
};

export default function StudentMenuPage() {
  const wrongCompletionOnly = useWrongCompletionDisplay();
  return (
    <StudentPageShell title="전체 메뉴" description="필요한 일을 선택하면 자세한 화면으로 이동해요."
      breadcrumbs={[{ label: "홈", to: "/student/dashboard" }]} noSectionFrame>
      <div className={styles.groups}>
        {STUDENT_NAV_GROUPS.map(group => (
          <section key={group.category} className={styles.group} aria-label={group.category}>
            <h2>{group.category}</h2>
            {group.items.map(({ to, label, Icon }) => (
              <Link key={to} to={to} className={styles.entry}>
                <Icon className={styles.icon} aria-hidden="true" />
                <span className={styles.copy}>
                  <strong>{to === "/student/idcard" && wrongCompletionOnly ? "오답 상태 카드" : label}</strong>
                  <span>{descriptions[to]}</span>
                </span>
                <IconChevronRight className={styles.arrow} aria-hidden="true" />
              </Link>
            ))}
          </section>
        ))}
      </div>
    </StudentPageShell>
  );
}
