// src/student/domains/exams/pages/ExamResultPage.tsx
/**
 * ✅ ExamResultPage (학생 결과)
 * - 대표 Result + ResultItem(문항별) 렌더링
 * - 판단/계산 ❌
 * - can_retake / is_pass 그대로 사용 ✅
 */

import { Link, useParams } from "react-router-dom";
import StudentPageShell from "../../../shared/ui/pages/StudentPageShell";
import EmptyState from "../../../shared/ui/layout/EmptyState";
import { useMyExamResult } from "@/student/domains/exams/hooks/useMyExamResult";
import { useMyExamResultItems } from "@/student/domains/exams/hooks/useMyExamResultItems";
import GradeBadge from "@/student/domains/grades/components/GradeBadge";

export default function ExamResultPage() {
  const { examId } = useParams();
  const safeId = Number(examId);

  const resultQ = useMyExamResult(Number.isFinite(safeId) ? safeId : undefined);
  const itemsQ = useMyExamResultItems(Number.isFinite(safeId) ? safeId : undefined);

  if (!Number.isFinite(safeId)) {
    return (
      <StudentPageShell title="시험 결과" description="잘못된 접근입니다.">
        <EmptyState title="잘못된 주소입니다." />
      </StudentPageShell>
    );
  }

  if (resultQ.isLoading) {
    return (
      <StudentPageShell title="시험 결과">
        <div style={{ padding: "var(--stu-space-4)", display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
          <div className="stu-skel" style={{ height: 120, borderRadius: "var(--stu-radius)" }} />
          <div className="stu-skel" style={{ height: 80, borderRadius: "var(--stu-radius)" }} />
        </div>
      </StudentPageShell>
    );
  }

  if (resultQ.isError || !resultQ.data) {
    return (
      <StudentPageShell title="시험 결과" description="조회 실패">
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
      title="시험 결과"
      actions={
        <Link to={`/student/exams/${safeId}`} style={linkBtn}>
          시험으로
        </Link>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* ===== Summary ===== */}
        <div style={card}>
          <div style={{ fontWeight: 900 }}>요약</div>

          <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center" }}>
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

        {/* ===== Items ===== */}
        <div style={card}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>문항별 결과</div>

          {itemsQ.isLoading && <div className="stu-muted" style={{ fontSize: 13 }}>문항 불러오는 중...</div>}
          {itemsQ.isError && <div style={{ fontSize: 13, color: "var(--stu-danger)" }}>문항 조회 실패</div>}

          {itemsQ.data && itemsQ.data.length === 0 && (
            <div className="stu-muted" style={{ fontSize: 13 }}>문항 데이터가 없습니다.</div>
          )}

          {!r.answers_visible && (
            <div className="stu-muted" style={{ fontSize: 13, padding: "6px 0" }}>
              정답은 비공개입니다.
              {r.answer_visibility === "after_closed" && " 시험 마감 후 공개됩니다."}
            </div>
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
                    내 답: {it.student_answer ?? "-"}
                    {r.answers_visible && it.correct_answer != null ? ` · 정답: ${it.correct_answer}` : ""}
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

const card: React.CSSProperties = {
  border: "1px solid var(--stu-border)",
  borderRadius: 12,
  padding: 14,
  background: "var(--stu-surface)",
};

const linkBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--stu-border)",
  textDecoration: "none",
  background: "var(--stu-surface-soft)",
  color: "var(--stu-text)",
  fontWeight: 700,
};
