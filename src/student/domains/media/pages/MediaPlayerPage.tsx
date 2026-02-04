// PATH: src/student/domains/media/pages/MediaPlayerPage.tsx
import { useSearchParams } from "react-router-dom";

import StudentPageShell from "@/student/shared/components/StudentPageShell";
import EmptyState from "@/student/shared/components/EmptyState";

/**
 * ✅ MediaPlayerPage (DUMMY / LOCK)
 *
 * 목적:
 * - 라우팅 자리 확보
 * - 빌드 안정성 확보
 * - 추후 media/playback 도메인 이식 예정
 *
 * 원칙:
 * - API 호출 ❌
 * - 플레이어 로직 ❌
 * - 정책 판단 ❌
 */

export default function MediaPlayerPage() {
  const [sp] = useSearchParams();
  const sessionId = sp.get("session");

  return (
    <StudentPageShell
      title="영상"
      description={sessionId ? `session: ${sessionId}` : "영상 플레이어"}
    >
      <EmptyState
        title="영상 플레이어 준비 중"
        description={
          <>
            이 페이지는 <b>미디어 도메인 연결 전 더미 페이지</b>입니다.
            <br />
            추후 영상 목록 / 재생 / 정책 로직이 이식될 예정입니다.
          </>
        }
      />
    </StudentPageShell>
  );
}
