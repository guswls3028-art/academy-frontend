// PATH: src/features/homework/panels/HomeworkResultsPanel.tsx
/**
 * HomeworkResultsPanel
 *
 * 요구사항:
 * - “미제출 학생만” 뜨면 됨
 *
 * ⚠️ 단일 진실이 아직 확정되지 않았으므로 UI 슬롯만 제공
 */

import { useMemo } from "react";
import { useAdminHomework } from "../hooks/useAdminHomework";

export default function HomeworkResultsPanel({
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
            결과
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            이 탭은 <b>미제출 학생</b>만 표시합니다.
          </div>
        </div>

        <div className="space-y-2 p-4 text-sm text-[var(--text-primary)]">
          <div className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] p-3 text-xs text-[var(--text-muted)]">
            ⚠️ 미제출 판단 데이터 소스(API)가 아직 확정되지 않아 UI 슬롯만
            제공합니다.
          </div>

          <div className="text-xs text-[var(--text-muted)]">
            sessionId: {sessionId || "-"}
          </div>
        </div>
      </section>
    </div>
  );
}
