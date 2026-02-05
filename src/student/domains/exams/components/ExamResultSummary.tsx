// PATH: src/student/domains/exams/components/ExamResultSummary.tsx

import { MyExamResult } from "../api/results";

export default function ExamResultSummary({
  result,
}: {
  result: MyExamResult;
}) {
  const pass = result.is_pass;

  return (
    <div
      className="stu-card"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>
          {result.total_score} / {result.max_score}
        </div>
        <div style={{ fontSize: 12, color: "var(--stu-text-muted)" }}>
          attempt #{result.attempt_id}
        </div>
      </div>

      <div
        style={{
          padding: "6px 12px",
          borderRadius: 999,
          fontWeight: 900,
          fontSize: 13,
          background: pass ? "#e7fff1" : "#ffecec",
          color: pass ? "#087443" : "#b00020",
        }}
      >
        {pass ? "PASS" : "FAIL"}
      </div>
    </div>
  );
}
