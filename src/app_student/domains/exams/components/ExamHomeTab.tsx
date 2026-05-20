/**
 * 시험 홈 탭 — 상태별 그룹핑 (응시가능 / 마감임박 / 완료·마감)
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import EmptyState from "@student/layout/EmptyState";
import { IconExam, IconChevronRight } from "@student/shared/ui/icons/Icons";
import type { StudentExam } from "../api/exams.api";
import styles from "./ExamHomeTab.module.css";

type Props = {
  items: StudentExam[];
};

type ExamSection = {
  key: string;
  title: string;
  exams: StudentExam[];
};

export default function ExamHomeTab({ items }: Props) {
  const sections = useMemo(() => categorize(items), [items]);

  if (items.length === 0) {
    return <EmptyState title="시험이 없습니다." description="등록된 시험이 있으면 여기에 표시됩니다." />;
  }

  return (
    <div className={styles.root}>
      {sections.map((section) => {
        if (section.exams.length === 0) return null;
        return (
          <div key={section.key}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>{section.title}</span>
              <span className={`stu-muted ${styles.sectionCount}`}>{section.exams.length}건</span>
            </div>
            <div data-guide="exam-list" className={styles.examList}>
              {section.exams.map((e) => (
                <ExamRow key={e.id} exam={e} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExamRow({ exam }: { exam: StudentExam }) {
  const status = getExamStatus(exam);
  const variant = getExamPanelVariant(exam);
  const urgency = getUrgency(exam);

  return (
    <Link
      to={`/student/exams/${exam.id}`}
      className={`stu-panel stu-panel--pressable stu-panel--accent ${variant} ${styles.examRow}`}
      data-urgency={urgency}
    >
      <div className={styles.iconWrap}>
        <IconExam className={styles.examIcon} />
      </div>
      <div className={styles.rowBody}>
        <div className={styles.examTitle}>{exam.title}</div>
        <div className={`stu-muted ${styles.examMeta}`}>
          {exam.close_at ? `마감: ${new Date(exam.close_at).toLocaleDateString("ko-KR")}` : "마감일 미정"}
        </div>
      </div>
      <span className={`stu-badge stu-badge--${status.variant} stu-badge--sm`}>
        {status.label}
      </span>
      <IconChevronRight className={styles.chevron} />
    </Link>
  );
}

/* ── Helpers ── */

function categorize(items: StudentExam[]): ExamSection[] {
  const now = new Date();
  const available: StudentExam[] = [];
  const urgent: StudentExam[] = [];
  const done: StudentExam[] = [];

  for (const e of items) {
    if (e.has_result || (e.attempt_count ?? 0) > 0) {
      done.push(e);
      continue;
    }
    const closeAt = e.close_at ? new Date(e.close_at) : null;
    if (closeAt && closeAt < now) {
      done.push(e);
      continue;
    }
    if (closeAt) {
      const hours = (closeAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hours <= 24) {
        urgent.push(e);
        continue;
      }
    }
    available.push(e);
  }

  return [
    { key: "urgent", title: "마감 임박", exams: urgent },
    { key: "available", title: "응시 가능", exams: available },
    { key: "done", title: "완료 / 마감", exams: done },
  ];
}

function getExamPanelVariant(exam: StudentExam): string {
  if (exam.has_result) return "stu-panel--complete";
  const now = new Date();
  const closeAt = exam.close_at ? new Date(exam.close_at) : null;
  if (!closeAt) return "stu-panel--action";
  const hours = (closeAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hours <= 0) return "stu-panel--complete";
  if (hours <= 24) return "stu-panel--danger";
  return "stu-panel--action";
}

function getUrgency(exam: StudentExam): string | undefined {
  const closeAt = exam.close_at ? new Date(exam.close_at) : null;
  if (!closeAt) return undefined;
  const hours = (closeAt.getTime() - new Date().getTime()) / (1000 * 60 * 60);
  if (hours > 0 && hours <= 6) return "high";
  return undefined;
}

function getExamStatus(exam: StudentExam): { label: string; variant: "success" | "danger" | "warn" | "neutral" } {
  if (exam.has_result) return { label: "채점완료", variant: "success" };
  if ((exam.attempt_count ?? 0) > 0) return { label: "응시완료", variant: "neutral" };
  const closeAt = exam.close_at ? new Date(exam.close_at) : null;
  if (closeAt && closeAt < new Date()) return { label: "마감", variant: "danger" };
  return { label: "미응시", variant: "warn" };
}
