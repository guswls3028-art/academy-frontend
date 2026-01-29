/**
 * HomeworkSetupPanel
 * - setup 탭 화면
 * - 커트라인(policy) + 과제 대상자 요약
 */

import { useMemo } from "react";
import { useAdminHomework } from "../hooks/useAdminHomework";

import HomeworkPolicyPanel from "./setup/HomeworkPolicyPanel";
import HomeworkEnrollmentPanel from "./setup/HomeworkEnrollmentPanel";

export default function HomeworkSetupPanel({ homeworkId }: { homeworkId: number }) {
  const { data } = useAdminHomework(homeworkId);

  const sessionId = useMemo(() => {
    const v = Number(data?.session_id);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }, [data?.session_id]);

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
