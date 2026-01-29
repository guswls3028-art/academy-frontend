// src/features/lectures/pages/exams/SessionExamsRoute.tsx
// --------------------------------------------------
// Route adapter
// - URL param(sessionId) → SessionExamsPage props로 전달
// --------------------------------------------------

import { useParams } from "react-router-dom";
import SessionExamsPage from "./SessionExamsPage";

export default function SessionExamsRoute() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const sid = Number(sessionId);

  if (!Number.isFinite(sid)) {
    return <div className="p-4 text-sm text-red-600">잘못된 sessionId</div>;
  }

  return <SessionExamsPage sessionId={sid} />;
}
