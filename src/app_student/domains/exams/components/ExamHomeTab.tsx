/** 시험 목록: 현재 응시 / 채점 대기 / 예정 / 결과 확인을 구분한다. */
import { Link } from "react-router";
import { Badge } from "@/shared/ui/ds";
import EmptyState from "@student/layout/EmptyState";
import { IconExam, IconChevronRight } from "@student/shared/ui/icons/Icons";
import { useLearningClock } from "@student/shared/hooks/useLearningClock";
import type { StudentExam } from "../api/exams.api";
import styles from "./ExamHomeTab.module.css";

type ExamState = "urgent" | "available" | "pending" | "upcoming" | "done";
const SECTIONS: { key: ExamState; title: string }[] = [
  { key: "urgent", title: "마감 임박" },
  { key: "available", title: "응시 가능" },
  { key: "pending", title: "제출 완료 · 채점 대기" },
  { key: "upcoming", title: "예정 시험" },
  { key: "done", title: "결과 확인 / 마감" },
];

function examState(exam: StudentExam, now: number): ExamState {
  if (exam.open_at && Date.parse(exam.open_at) > now) return "upcoming";
  if (exam.submission_pending) return "pending";
  if (exam.has_result || exam.learning_todo_eligible === false
    || (exam.close_at && Date.parse(exam.close_at) <= now)) return "done";
  if (exam.close_at && Date.parse(exam.close_at) - now <= 24 * 60 * 60 * 1000) return "urgent";
  return "available";
}

export default function ExamHomeTab({ items }: { items: StudentExam[] }) {
  const now = useLearningClock();
  if (items.length === 0) {
    return <EmptyState title="시험이 없습니다." description="등록된 시험이 있으면 여기에 표시됩니다." />;
  }
  return (
    <div className={styles.root}>
      {SECTIONS.map((section) => {
        const exams = items.filter((exam) => examState(exam, now) === section.key);
        if (!exams.length) return null;
        return (
          <section key={section.key} aria-label={section.title}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>{section.title}</span>
              <span className={`stu-muted ${styles.sectionCount}`}>{exams.length}건</span>
            </div>
            <div data-guide="exam-list" className={styles.examList}>
              {exams.map((exam) => <ExamRow key={exam.id} exam={exam} state={section.key} now={now} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ExamRow({ exam, state, now }: { exam: StudentExam; state: ExamState; now: number }) {
  const upcoming = state === "upcoming";
  const closed = !!exam.close_at && Date.parse(exam.close_at) <= now;
  const status = upcoming ? "시작 전" : state === "pending" ? "채점 대기"
    : exam.has_result ? (exam.student_results_published === false ? "성적 공개 전" : "채점 완료")
      : closed ? "마감" : exam.learning_todo_eligible === false ? "기록 확인" : "미응시";
  const variant = state === "urgent" ? "stu-panel--danger"
    : state === "available" ? "stu-panel--action" : "stu-panel--complete";
  const className = `stu-panel stu-panel--accent ${variant} ${styles.examRow}`;
  const content = (
    <>
      <div className={styles.iconWrap}><IconExam className={styles.examIcon} /></div>
      <div className={styles.rowBody}>
        <div className={styles.examTitle}>{exam.title}</div>
        <div className={`stu-muted ${styles.examMeta}`}>
          {upcoming
            ? `시작: ${new Date(exam.open_at!).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
            : exam.close_at ? `마감: ${new Date(exam.close_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : "마감일 미정"}
        </div>
        {upcoming && <div className={`stu-muted ${styles.examMeta}`}>시작 시각에 응시할 수 있어요.</div>}
      </div>
      <Badge tone={state === "urgent" ? "danger" : state === "available" ? "warning" : "neutral"} size="sm">{status}</Badge>
      {!upcoming && <IconChevronRight className={styles.chevron} />}
    </>
  );
  // Planned exams expose their schedule, never a link to a not-yet-authorized exam detail.
  return upcoming ? <div className={className}>{content}</div> : (
    <Link
      to={closed || exam.learning_todo_eligible === false ? "/student/grades" : `/student/exams/${exam.id}`}
      className={`${className} stu-panel--pressable`}
      data-urgency={state === "urgent" && Date.parse(exam.close_at!) - now <= 6 * 60 * 60 * 1000 ? "high" : undefined}
    >{content}</Link>
  );
}
