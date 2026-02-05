// PATH: src/student/domains/exams/pages/ExamListPage.tsx
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { useStudentExams } from "../hooks/useStudentExams";
import ExamCard from "../components/ExamCard";

export default function ExamListPage() {
  const { data, isLoading, isError } = useStudentExams();
  const items = data?.items ?? [];

  return (
    <StudentPageShell title="시험">
      {isLoading && <div>불러오는 중…</div>}
      {isError && <EmptyState title="시험 목록 오류" />}

      {items.length === 0 && (
        <EmptyState title="시험이 없습니다." />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((e) => (
          <ExamCard key={e.id} exam={e} />
        ))}
      </div>
    </StudentPageShell>
  );
}
