/**
 * HomeworkSetupPanel
 * - setup 탭 화면
 * - 커트라인(policy) + 과제 대상자 요약
 * - sessionId: URL의 sessionId를 우선 사용해 정책 조회가 과제 로드 전에도 성공하도록 함
 */

import { useMemo } from "react";
import { useAdminHomework } from "../hooks/useAdminHomework";

import HomeworkPolicyPanel from "./setup/HomeworkPolicyPanel";
import HomeworkEnrollmentPanel from "./setup/HomeworkEnrollmentPanel";

export default function HomeworkSetupPanel({
  homeworkId,
  sessionIdFromRoute,
  homeworkSessionId,
}: {
  homeworkId: number;
  /** URL의 sessionId (라우트에서 바로 사용, 정책 조회용) */
  sessionIdFromRoute?: number;
  /** 과제 API에서 온 session_id (과제 소속 검증용) */
  homeworkSessionId?: number;
}) {
  const { data } = useAdminHomework(homeworkId);

  const sessionId = useMemo(() => {
    const fromRoute = Number(sessionIdFromRoute);
    const fromHomework = Number(homeworkSessionId ?? data?.session_id);
    if (Number.isFinite(fromRoute) && fromRoute > 0) return fromRoute;
    if (Number.isFinite(fromHomework) && fromHomework > 0) return fromHomework;
    return 0;
  }, [sessionIdFromRoute, homeworkSessionId, data?.session_id]);

  return (
    <div className="space-y-6">
      <HomeworkPolicyPanel sessionId={sessionId} />
      <HomeworkEnrollmentPanel homeworkId={homeworkId} />

      <section className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] p-4 text-sm text-[var(--text-secondary)]">
        ℹ️ 과제 점수 입력·판정은 <b>세션 &gt; 성적</b> 메뉴에서 진행합니다.
      </section>
    </div>
  );
}
