// PATH: src/features/homework/panels/HomeworkSubmissionsPanel.tsx
/**
 * HomeworkSubmissionsPanel
 *
 * ✅ 의도
 * - 신규 제출 시스템 만들지 않음
 * - submissions 도메인 재사용 전제
 *
 * ⚠️ 현재는 API 스펙 미확정 → UI 슬롯만 제공
 */

import { useMemo } from "react";
import { useAdminHomework } from "../hooks/useAdminHomework";

export default function HomeworkSubmissionsPanel({
  homeworkId,
}: {
  homeworkId: number;
}) {
  const { data } = useAdminHomework(homeworkId);

  const sessionId = useMemo(() => {
    const v = Number(data?.session_id);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }, [data?.session_id]);

  return (
    <div className="space-y-6">
      <section className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)]">
        <div className="border-b border-[var(--border-divider)] px-4 py-3">
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            제출
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            온라인 과제 제출은 <b>submissions</b> 도메인을 재사용합니다.
          </div>
        </div>

        <div className="space-y-2 p-4 text-sm text-[var(--text-primary)]">
          <div className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] p-3 text-xs text-[var(--text-muted)]">
            ✅ 여기는 아래 중 하나로 연결하면 됩니다.
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>기존 Submission 업로드/등록 컴포넌트 재사용</li>
              <li>
                submissions API에 homework target_type 지원 시
                목록/업로드 UI 제공
              </li>
            </ul>
          </div>

          <div className="text-xs text-[var(--text-muted)]">
            sessionId: {sessionId || "-"}
          </div>
        </div>
      </section>

      <section className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] p-4 text-sm text-[var(--text-muted)]">
        ℹ️ 이 탭은 “제출 원본 관리” 목적이며, 점수/판정은 성적탭에서
        합니다.
      </section>
    </div>
  );
}
