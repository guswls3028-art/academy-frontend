// PATH: src/student/domains/sessions/components/SessionExamAction.tsx
/**
 * SessionExamAction — 차시의 시험 진입 액션
 * exam_ids 배열이 있으면 각 시험으로 직접 링크, 없으면 시험 목록으로.
 */
import { Link } from "react-router-dom";

type SessionExamActionProps = {
  examIds?: number[];
};

export default function SessionExamAction({ examIds }: SessionExamActionProps) {
  if (Array.isArray(examIds) && examIds.length > 0) {
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {examIds.map((eid, idx) => (
          <Link key={eid} to={`/student/exams/${eid}`} className="stu-cta-link">
            {examIds.length === 1 ? "시험 보기" : `${idx + 1}차 시험`}
          </Link>
        ))}
      </div>
    );
  }
  return (
    <Link to="/student/exams" className="stu-cta-link">
      시험 목록 보기
    </Link>
  );
}
