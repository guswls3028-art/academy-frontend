// PATH: src/student/domains/grades/pages/GradeListPage.tsx
/**
 * GradeListPage — 시험·과제 성적 전체 목록
 * GradesPage(허브)에서 "전체 보기" 진입 시 사용.
 */
import { Link } from "react-router-dom";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { useMyGradesSummary } from "../hooks/useMyGradesSummary";
import GradeRow from "../components/GradeRow";
import { IconExam, IconChevronRight, IconClipboard } from "@/student/shared/ui/icons/Icons";

function scoreLabel(score: number, max: number | null): string {
  if (max == null || max <= 0) return `${score}점`;
  return `${score}/${max}점`;
}

export default function GradeListPage() {
  const { data, isLoading, isError } = useMyGradesSummary();
  const exams = data?.exams ?? [];
  const homeworks = data?.homeworks ?? [];

  return (
    <StudentPageShell title="성적 전체보기">
      {isLoading && (
        <div className="stu-muted" style={{ padding: "var(--stu-space-4) 0" }}>
          불러오는 중…
        </div>
      )}
      {isError && (
        <EmptyState title="성적을 불러올 수 없습니다." description="잠시 후 다시 시도해 주세요." />
      )}

      {!isLoading && !isError && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-6)" }}>
          {/* 시험 */}
          <section>
            <div
              className="stu-muted"
              style={{ fontSize: 13, fontWeight: 600, marginBottom: "var(--stu-space-2)" }}
            >
              시험 결과 ({exams.length})
            </div>
            {exams.length === 0 ? (
              <div className="stu-section stu-section--nested">
                <EmptyState compact title="기입된 시험 결과가 없습니다." />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
                {exams.map((e) => (
                  <Link
                    key={e.exam_id}
                    to={`/student/exams/${e.exam_id}/result`}
                    className="stu-panel stu-panel--pressable stu-panel--accent"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <GradeRow
                      icon={<IconExam style={{ width: 22, height: 22, color: "var(--stu-primary)" }} />}
                      title={e.title}
                      subtitle={e.lecture_title}
                      score={scoreLabel(e.total_score, e.max_score)}
                      passed={e.is_pass}
                      trailingIcon={<IconChevronRight style={{ width: 20, height: 20, color: "var(--stu-text-muted)" }} />}
                    />
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* 과제 */}
          <section>
            <div
              className="stu-muted"
              style={{ fontSize: 13, fontWeight: 600, marginBottom: "var(--stu-space-2)" }}
            >
              과제 이력 ({homeworks.length})
            </div>
            {homeworks.length === 0 ? (
              <div className="stu-section stu-section--nested">
                <EmptyState compact title="기입된 과제 성적이 없습니다." />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
                {homeworks.map((h, idx) => (
                  <div
                    key={`${h.homework_id}-${idx}`}
                    className="stu-panel stu-panel--accent"
                  >
                    <GradeRow
                      icon={<IconClipboard style={{ width: 22, height: 22, color: "var(--stu-primary)" }} />}
                      title={h.title}
                      subtitle={h.lecture_title}
                      score={scoreLabel(h.score, h.max_score)}
                      passed={h.passed ? true : undefined}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </StudentPageShell>
  );
}
