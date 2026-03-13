// PATH: src/features/homework/components/AdminHomeworkDetail.tsx
/**
 * AdminHomeworkDetail
 *
 * ✅ 시험 AdminExamDetail과 동일한 탭 구조
 * - design: 기본 설정 | 자산 | 제출관리 | 결과
 * - operate(세션 컨텍스트): 운영 | 제출관리 | 결과
 *
 * 🚫 금지
 * - 점수 계산 ❌
 * - passed 계산 ❌
 * - HomeworkScore 생성 ❌
 */

import { useState } from "react";
import type { HomeworkTabKey, HomeworkSummary } from "../types";

import HomeworkHeader from "./common/HomeworkHeader";
import HomeworkTabs from "./common/HomeworkTabs";
import { EmptyState } from "@/shared/ui/ds";
import { useAdminHomework } from "../hooks/useAdminHomework";
import HomeworkSetupPanel from "../panels/HomeworkSetupPanel";
import HomeworkAssetsPanel from "../panels/HomeworkAssetsPanel";
import HomeworkSubmissionsPanel from "../panels/HomeworkSubmissionsPanel";
import HomeworkResultsPanel from "../panels/HomeworkResultsPanel";

export type HomeworkDetailMode = "design" | "operate";

export default function AdminHomeworkDetail({
  homeworkId,
  sessionId: sessionIdFromRoute,
  mode = "design",
}: {
  homeworkId: number;
  /** URL의 sessionId (과제 정책 조회용, 있으면 과제 로드 전에도 사용) */
  sessionId?: number;
  /** operate 시 3탭(운영|제출관리|결과), design 시 4탭 — 시험과 동일 */
  mode?: HomeworkDetailMode;
}) {
  const [activeTab, setActiveTab] = useState<HomeworkTabKey>("setup");
  const { data, isLoading, isError } = useAdminHomework(homeworkId);

  if (!Number.isFinite(homeworkId) || homeworkId <= 0) {
    return <EmptyState scope="panel" tone="error" title="과제 ID가 올바르지 않습니다." />;
  }

  if (isLoading) {
    return <EmptyState scope="panel" tone="loading" title="과제 정보 불러오는 중…" />;
  }

  if (isError || !data) {
    return <EmptyState scope="panel" tone="error" title="과제 정보를 불러오지 못했습니다." />;
  }

  const summary: HomeworkSummary = {
    id: data.id,
    title: data.title,
    status: data.status,
    session_id: data.session_id,
    homework_type: data.homework_type,
    template_homework_id: data.template_homework_id,
  };

  return (
    <div className="space-y-6">
      <HomeworkHeader homework={summary} sessionId={sessionIdFromRoute ?? data?.session_id} />
      <HomeworkTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        mode={mode}
      />

      {/* design mode: 개별 탭 렌더링 */}
      {mode === "design" && activeTab === "setup" && (
        <HomeworkSetupPanel
          homeworkId={homeworkId}
          sessionIdFromRoute={sessionIdFromRoute}
          homeworkSessionId={data?.session_id}
        />
      )}
      {mode === "design" && activeTab === "assets" && (
        <HomeworkAssetsPanel homeworkId={homeworkId} />
      )}

      {/* operate mode: 운영 탭 = setup + assets 통합 */}
      {mode === "operate" && activeTab === "setup" && (
        <div className="space-y-6">
          <HomeworkSetupPanel
            homeworkId={homeworkId}
            sessionIdFromRoute={sessionIdFromRoute}
            homeworkSessionId={data?.session_id}
          />
          <HomeworkAssetsPanel homeworkId={homeworkId} />
        </div>
      )}

      {/* 제출관리: 양쪽 모드에서 독립 탭 */}
      {activeTab === "submissions" && (
        <HomeworkSubmissionsPanel homeworkId={homeworkId} />
      )}

      {activeTab === "results" && (
        <HomeworkResultsPanel homeworkId={homeworkId} />
      )}
    </div>
  );
}
