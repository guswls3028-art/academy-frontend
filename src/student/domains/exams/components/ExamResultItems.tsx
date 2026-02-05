// PATH: src/student/domains/exams/components/ExamResultItems.tsx

import { MyExamResultItem } from "../api/results";

export default function ExamResultItems({
  items,
}: {
  items: MyExamResultItem[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((it) => (
        <div
          key={`${it.question_id}-${it.question_number}`}
          style={{
            border: "1px solid var(--stu-border)",
            borderRadius: 12,
            padding: 12,
            background: "var(--stu-surface)",
          }}
        >
          <div style={{ fontWeight: 900 }}>
            Q{it.question_number}
          </div>

          <div
            style={{
              fontSize: 13,
              marginTop: 6,
              color: it.is_correct ? "#087443" : "#b00020",
              fontWeight: 800,
            }}
          >
            {it.is_correct ? "정답" : "오답"} · {it.score}/{it.max_score}
          </div>

          <div
            style={{
              fontSize: 12,
              marginTop: 6,
              color: "var(--stu-text-muted)",
            }}
          >
            내 답: {it.student_answer ?? "-"} / 정답:{" "}
            {it.correct_answer ?? "-"}
          </div>
        </div>
      ))}
    </div>
  );
}
