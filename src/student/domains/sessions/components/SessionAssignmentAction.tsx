// PATH: src/student/domains/sessions/components/SessionAssignmentAction.tsx
/**
 * SessionAssignmentAction — 차시의 과제 제출 액션
 * submission_hub 또는 /student/submit 으로 진입.
 */
import { Link } from "react-router-dom";

type SessionAssignmentActionProps = {
  sessionId?: number;
};

export default function SessionAssignmentAction({ sessionId }: SessionAssignmentActionProps) {
  const to = sessionId
    ? `/student/submit/assignment?sessionId=${sessionId}`
    : "/student/submit/assignment";
  return (
    <Link to={to} className="stu-cta-link">
      과제 제출
    </Link>
  );
}
