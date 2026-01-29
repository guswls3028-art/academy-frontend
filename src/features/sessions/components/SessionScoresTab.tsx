// PATH: src/features/sessions/components/SessionScoresTab.tsx
/**
 * ✅ SessionScoresTab (FINAL / 정석)
 *
 * 책임:
 * - sessions 탭에서 scores 도메인 화면을 연결
 *
 * 원칙:
 * - sessionId는 useSessionParams에서 직접 획득
 * - 성적 UI / 선택 / SidePanel 로직 ❌
 * - scores 도메인의 SessionScoresPanel이 단일 진실
 */

import { useSessionParams } from "../hooks/useSessionParams";
import SessionScoresPanel from "@/features/scores/panels/SessionScoresPanel";

export default function SessionScoresTab() {
  const { sessionId } = useSessionParams();

  if (!sessionId) {
    return (
      <div className="text-sm text-red-600">
        잘못된 sessionId
      </div>
    );
  }

  return <SessionScoresPanel sessionId={sessionId} />;
}
