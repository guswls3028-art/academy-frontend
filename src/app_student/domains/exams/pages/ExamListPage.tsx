// PATH: src/app_student/domains/exams/pages/ExamListPage.tsx
import { Link } from "react-router-dom";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import EmptyState from "@student/layout/EmptyState";
import { useStudentExams } from "../hooks/useStudentExams";
import { StudentExam } from "../api/exams.api";
import { IconExam, IconChevronRight } from "@student/shared/ui/icons/Icons";
import GradeBadge from "@student/domains/grades/components/GradeBadge";

export default function ExamListPage() {
  const { data, isLoading, isError, refetch } = useStudentExams();
  const items = data?.items ?? [];

  // 상태 기반 Panel variant 결정 (제출 상태 + deadline 기반)
  const getExamPanelVariant = (exam: StudentExam): string => {
    // 이미 제출 완료된 시험 → complete
    if (exam.has_result) {
      return "stu-panel--complete";
    }

    const now = new Date();
    const closeAt = exam.close_at ? new Date(exam.close_at) : null;

    if (!closeAt) {
      return "stu-panel--action";
    }

    const hoursUntilClose = (closeAt.getTime() - now.getTime()) / (1000 * 60 * 60);

    // 마감 지남
    if (hoursUntilClose <= 0) {
      return "stu-panel--complete";
    }

    // 마감 임박 (24시간 이내)
    if (hoursUntilClose > 0 && hoursUntilClose <= 24) {
      return "stu-panel--danger";
    }

    // 응시 가능 (24시간 이상 남음)
    return "stu-panel--action";
  };

  // 시간 압박도 결정 (6시간 이내)
  const getUrgency = (exam: StudentExam): string | undefined => {
    const now = new Date();
    const closeAt = exam.close_at ? new Date(exam.close_at) : null;
    
    if (!closeAt) {
      return undefined;
    }

    const hoursUntilClose = (closeAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    // 6시간 이내 → high urgency
    if (hoursUntilClose > 0 && hoursUntilClose <= 6) {
      return "high";
    }
    
    return undefined;
  };

  // 시험 상태 텍스트 + 배지
  const getExamStatus = (exam: StudentExam): { label: string; variant: "success" | "danger" | "warn" | "neutral" } => {
    if (exam.has_result) {
      return { label: "채점완료", variant: "success" };
    }
    if ((exam.attempt_count ?? 0) > 0) {
      return { label: "응시완료", variant: "neutral" };
    }
    const now = new Date();
    const closeAt = exam.close_at ? new Date(exam.close_at) : null;
    if (closeAt && closeAt < now) {
      return { label: "마감", variant: "danger" };
    }
    return { label: "미응시", variant: "warn" };
  };

  return (
    <StudentPageShell title="시험">
      {isLoading && (
        <div style={{ padding: "var(--stu-space-4)", display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
          <div className="stu-skel" style={{ height: 80, borderRadius: "var(--stu-radius)" }} />
          <div className="stu-skel" style={{ height: 80, borderRadius: "var(--stu-radius)" }} />
          <div className="stu-skel" style={{ height: 80, borderRadius: "var(--stu-radius)" }} />
        </div>
      )}
      {isError && <EmptyState title="시험을 불러오지 못했습니다" description="네트워크 연결을 확인하고 잠시 후 다시 시도해 주세요." onRetry={() => refetch()} />}

      {!isLoading && !isError && items.length === 0 && (
        <EmptyState title="시험이 없습니다." description="등록된 시험이 있으면 여기에 표시됩니다." />
      )}

      <div data-guide="exam-list" style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
        {items.map((e) => {
          const variant = getExamPanelVariant(e);
          const urgency = getUrgency(e);
          const status = getExamStatus(e);

          return (
            <Link
              key={e.id}
              to={`/student/exams/${e.id}`}
              className={`stu-panel stu-panel--pressable stu-panel--accent ${variant}`}
              data-urgency={urgency}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--stu-space-4)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--stu-surface-soft)", display: "grid", placeItems: "center" }}>
              <IconExam style={{ width: 22, height: 22, color: "var(--stu-primary)" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{e.title}</div>
              <div className="stu-muted" style={{ fontSize: 13, marginTop: 2 }}>
                {e.close_at ? `마감: ${new Date(e.close_at).toLocaleDateString("ko-KR")}` : "마감일 미정"}
              </div>
            </div>
            <span className={`stu-badge stu-badge--${status.variant} stu-badge--sm`}>
              {status.label}
            </span>
            <IconChevronRight style={{ width: 20, height: 20, color: "var(--stu-text-muted)" }} />
            </Link>
          );
        })}
      </div>
    </StudentPageShell>
  );
}
