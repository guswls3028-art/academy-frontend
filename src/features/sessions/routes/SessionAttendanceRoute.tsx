// PATH: src/features/sessions/routes/SessionAttendanceRoute.tsx

import { useSessionParams } from "../hooks/useSessionParams";
import SessionAttendancePage from "@/features/lectures/pages/attendance/SessionAttendancePage";

export default function SessionAttendanceRoute() {
  const { sessionId } = useSessionParams();
  if (!sessionId) return <div className="text-sm text-red-600">잘못된 sessionId</div>;
  return <SessionAttendancePage sessionId={sessionId} />;
}
