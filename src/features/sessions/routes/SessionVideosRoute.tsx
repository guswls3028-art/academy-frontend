// PATH: src/features/sessions/routes/SessionVideosRoute.tsx

import { useSessionParams } from "../hooks/useSessionParams";
import SessionVideosTab from "@/features/lectures/components/SessionVideosTab";

export default function SessionVideosRoute() {
  const { sessionId } = useSessionParams();
  if (!sessionId) return <div className="text-sm text-red-600">잘못된 sessionId</div>;
  return <SessionVideosTab sessionId={sessionId} />;
}
