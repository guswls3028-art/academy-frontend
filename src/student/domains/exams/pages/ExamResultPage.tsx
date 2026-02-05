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

export default function ExamResultPage() {
  const { examId } = useParams();
  const safeId = Number(examId);

  const resultQ = useMyExamResult(Number.isFinite(safeId) ? safeId : undefined);
  const itemsQ = useMyExamResultItems(Number.isFinite(safeId) ? safeId : undefined);

  if (!Number.isFinite(safeId)) {
    return (
      <StudentPageShell title="시험 결과" description="잘못된 접근입니다.">
        <EmptyState title="시험 ID가 올바르지 않습니다." />
      </StudentPageShell>
    );
  }

  if (resultQ.isLoading) {
    return (
      <StudentPageShell title="시험 결과" description="불러오는 중...">
        <div style={{ fontSize: 14, color: "#666" }}>불러오는 중...</div>
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
      description={`exam_id: ${r.exam_id} · attempt_id: ${r.attempt_id}`}
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

            <span
              style={{
                padding: "4px 8px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 900,
                background: r.is_pass ? "#e8fff0" : "#ffecec",
                color: r.is_pass ? "#0a7a38" : "#b10000",
              }}
            >
              {r.is_pass ? "통과" : "미통과"}
            </span>
          </div>

          <div style={{ marginTop: 8, fontSize: 13, color: "#666" }}>
            submitted_at: {r.submitted_at ?? "-"}
          </div>

          <div style={{ marginTop: 8, fontSize: 13, color: "#666" }}>
            can_retake: <b>{String(r.can_retake)}</b>
          </div>
        </div>

        {/* ===== Items ===== */}
        <div style={card}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>문항별 결과</div>

          {itemsQ.isLoading && <div style={{ fontSize: 13, color: "#666" }}>문항 불러오는 중...</div>}
          {itemsQ.isError && <div style={{ fontSize: 13, color: "#c00" }}>문항 조회 실패</div>}

          {itemsQ.data && itemsQ.data.length === 0 && (
            <div style={{ fontSize: 13, color: "#777" }}>문항 데이터가 없습니다.</div>
          )}

          {itemsQ.data && itemsQ.data.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {itemsQ.data.map((it) => (
                <div
                  key={`${it.question_id}-${it.question_number}`}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 10,
                    padding: 10,
                    background: "#fafafa",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>
                    Q{it.question_number} (id:{it.question_id})
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: "#444" }}>
                    정오: <b>{it.is_correct ? "정답" : "오답"}</b>
                    {" · "}
                    점수: <b>{it.score}</b> / {it.max_score}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: "#666" }}>
                    내 답: {it.student_answer ?? "-"} / 정답: {it.correct_answer ?? "-"}
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
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 14,
  background: "#fff",
};

const linkBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  textDecoration: "none",
  background: "#fafafa",
  color: "#111",
  fontWeight: 800,
};
