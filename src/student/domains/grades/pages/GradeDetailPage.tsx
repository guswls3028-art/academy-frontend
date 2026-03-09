// PATH: src/student/domains/grades/pages/GradeDetailPage.tsx
/**
 * GradeDetailPage — 시험 결과 상세 (ExamResultPage의 성적 도메인 진입점)
 * /student/grades/exams/:examId 라우트에서 사용.
 * 실제 채점 데이터는 ExamResultPage 와 동일한 훅을 재사용.
 */
import { Link, useParams } from "react-router-dom";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import GradeBadge from "../components/GradeBadge";
import { useMyExamResult } from "@/student/domains/exams/hooks/useMyExamResult";
import { useMyExamResultItems } from "@/student/domains/exams/hooks/useMyExamResultItems";

export default function GradeDetailPage() {
  const { examId } = useParams();
  const safeId = Number(examId);

  const resultQ = useMyExamResult(Number.isFinite(safeId) ? safeId : undefined);
  const itemsQ = useMyExamResultItems(Number.isFinite(safeId) ? safeId : undefined);

  if (!Number.isFinite(safeId)) {
    return (
      <StudentPageShell title="성적 상세" description="잘못된 접근입니다.">
        <EmptyState title="시험 ID가 올바르지 않습니다." />
      </StudentPageShell>
    );
  }

  if (resultQ.isLoading) {
    return (
      <StudentPageShell title="성적 상세" description="불러오는 중...">
        <div className="stu-muted" style={{ fontSize: 14 }}>불러오는 중...</div>
      </StudentPageShell>
    );
  }

  if (resultQ.isError || !resultQ.data) {
    return (
      <StudentPageShell title="성적 상세" description="조회 실패">
        <EmptyState
          title="결과를 불러오지 못했습니다."
          description="아직 채점 전이거나 권한/데이터가 없을 수 있습니다."
        />
      </StudentPageShell>
    );
  }

  const r = resultQ.data;

  return (
    <StudentPageShell
      title="성적 상세"
      actions={
        <Link to="/student/grades" className="stu-cta-link">
          성적 목록
        </Link>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* 요약 */}
        <div className="stu-section">
          <div style={{ fontWeight: 900, marginBottom: 8 }}>요약</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>
              {r.total_score} / {r.max_score}
            </div>
            <GradeBadge passed={r.is_pass} />
          </div>
          {r.submitted_at && (
            <div className="stu-muted" style={{ marginTop: 8, fontSize: 13 }}>
              제출일: {new Date(r.submitted_at).toLocaleDateString("ko-KR")}
            </div>
          )}
        </div>

        {/* 문항별 결과 */}
        <div className="stu-section">
          <div style={{ fontWeight: 900, marginBottom: 8 }}>문항별 결과</div>

          {itemsQ.isLoading && (
            <div className="stu-muted" style={{ fontSize: 13 }}>문항 불러오는 중...</div>
          )}
          {itemsQ.isError && (
            <div style={{ fontSize: 13, color: "var(--stu-danger)" }}>문항 조회 실패</div>
          )}

          {itemsQ.data && itemsQ.data.length === 0 && (
            <div className="stu-muted" style={{ fontSize: 13 }}>문항 데이터가 없습니다.</div>
          )}

          {itemsQ.data && itemsQ.data.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {itemsQ.data.map((it) => (
                <div
                  key={`${it.question_id}-${it.question_number}`}
                  style={{
                    border: "1px solid var(--stu-border)",
                    borderRadius: 10,
                    padding: 10,
                    background: it.is_correct ? "var(--stu-success-bg)" : "var(--stu-surface-soft)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{it.question_number}번</span>
                    <GradeBadge passed={it.is_correct} label={{ pass: "정답", fail: "오답" }} />
                    <span className="stu-muted" style={{ fontSize: 12, marginLeft: "auto" }}>
                      {it.score} / {it.max_score}점
                    </span>
                  </div>
                  <div className="stu-muted" style={{ marginTop: 6, fontSize: 13 }}>
                    내 답: {it.student_answer ?? "-"} · 정답: {it.correct_answer ?? "-"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </StudentPageShell>
  );
}
