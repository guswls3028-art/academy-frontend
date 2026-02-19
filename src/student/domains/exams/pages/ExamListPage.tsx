// PATH: src/student/domains/exams/pages/ExamListPage.tsx
import { Link } from "react-router-dom";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { useStudentExams } from "../hooks/useStudentExams";
import { StudentExam } from "../api/exams";
import { IconExam, IconChevronRight } from "@/student/shared/ui/icons/Icons";

export default function ExamListPage() {
  const { data, isLoading, isError } = useStudentExams();
  const items = data?.items ?? [];

  // 상태 기반 Panel variant 결정 (deadline 기반)
  const getExamPanelVariant = (exam: StudentExam): string => {
    const now = new Date();
    const closeAt = exam.close_at ? new Date(exam.close_at) : null;
    
    if (!closeAt) {
      return "stu-panel--nav";
    }

    const hoursUntilClose = (closeAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    // 마감 임박 (24시간 이내)
    if (hoursUntilClose > 0 && hoursUntilClose <= 24) {
      return "stu-panel--danger";
    }
    
    // 마감 지남
    if (hoursUntilClose <= 0) {
      return "stu-panel--complete";
    }
    
    // 응시 가능 (24시간 이상 남음)
    const openAt = exam.open_at ? new Date(exam.open_at) : null;
    if (openAt && now >= openAt) {
      return "stu-panel--action";
    }
    
    return "stu-panel--nav";
  };

  return (
    <StudentPageShell title="시험">
      {isLoading && <div>불러오는 중…</div>}
      {isError && <EmptyState title="시험 목록 오류" />}

      {items.length === 0 && (
        <EmptyState title="시험이 없습니다." />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
        {items.map((e) => (
          <Link
            key={e.id}
            to={`/student/exams/${e.id}`}
            className={`stu-panel stu-panel--pressable stu-panel--accent ${getExamPanelVariant(e)}`}
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
                {e.close_at ? `마감: ${new Date(e.close_at).toLocaleDateString()}` : "마감일 미정"}
              </div>
            </div>
            <IconChevronRight style={{ width: 20, height: 20, color: "var(--stu-text-muted)" }} />
          </Link>
        ))}
      </div>
    </StudentPageShell>
  );
}
