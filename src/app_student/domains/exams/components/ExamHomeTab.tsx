/**
 * 시험 홈 탭 — 상태별 그룹핑 (응시가능 / 마감임박 / 완료·마감)
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import EmptyState from "@student/layout/EmptyState";
import { IconExam, IconChevronRight } from "@student/shared/ui/icons/Icons";
import GradeBadge from "@student/domains/grades/components/GradeBadge";
import type { StudentExam } from "../api/exams.api";

type Props = {
  items: StudentExam[];
};

type ExamSection = {
  key: string;
  title: string;
  exams: StudentExam[];
  variant: string;
};

export default function ExamHomeTab({ items }: Props) {
  const sections = useMemo(() => categorize(items), [items]);

  if (items.length === 0) {
    return <EmptyState title="시험이 없습니다." description="등록된 시험이 있으면 여기에 표시됩니다." />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-6)" }}>
      {sections.map((section) => {
        if (section.exams.length === 0) return null;
        return (
          <div key={section.key}>
            <div style={sectionHeader}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{section.title}</span>
              <span className="stu-muted" style={{ fontSize: 12 }}>{section.exams.length}건</span>
            </div>
            <div data-guide="exam-list" style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
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
      className={`stu-panel stu-panel--pressable stu-panel--accent ${variant}`}
      data-urgency={urgency}
      style={{ display: "flex", alignItems: "center", gap: "var(--stu-space-4)", textDecoration: "none", color: "inherit" }}
    >
      <div style={iconWrap}>
        <IconExam style={{ width: 22, height: 22, color: "var(--stu-primary)" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{exam.title}</div>
        <div className="stu-muted" style={{ fontSize: 13, marginTop: 2 }}>
          {exam.close_at ? `마감: ${new Date(exam.close_at).toLocaleDateString("ko-KR")}` : "마감일 미정"}
        </div>
      </div>
      <span className={`stu-badge stu-badge--${status.variant} stu-badge--sm`}>
        {status.label}
      </span>
      <IconChevronRight style={{ width: 20, height: 20, color: "var(--stu-text-muted)" }} />
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
    { key: "urgent", title: "마감 임박", exams: urgent, variant: "danger" },
    { key: "available", title: "응시 가능", exams: available, variant: "action" },
    { key: "done", title: "완료 / 마감", exams: done, variant: "complete" },
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

const iconWrap: React.CSSProperties = {
  width: 44, height: 44, borderRadius: 12,
  background: "var(--stu-surface-soft)", display: "grid", placeItems: "center",
};

const sectionHeader: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "var(--stu-space-3) var(--stu-space-4)",
  marginBottom: "var(--stu-space-2)",
  borderLeft: "4px solid var(--stu-primary)",
  background: "var(--stu-tint-primary)",
  borderRadius: "0 var(--stu-radius-xl) var(--stu-radius-xl) 0",
};
