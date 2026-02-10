// PATH: src/features/lectures/pages/exams/SessionExamsRoute.tsx
import { useParams } from "react-router-dom";
import SessionExamsPage from "./SessionExamsPage";

export default function SessionExamsRoute() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const sid = Number(sessionId);

  if (!Number.isFinite(sid)) {
    return <div className="p-4 text-sm" style={{ color: "var(--color-error)" }}>잘못된 sessionId</div>;
  }

  return <SessionExamsPage sessionId={sid} />;
}
