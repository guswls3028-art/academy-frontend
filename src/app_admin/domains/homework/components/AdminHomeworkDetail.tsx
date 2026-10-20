// PATH: src/app_admin/domains/homework/components/AdminHomeworkDetail.tsx
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

import { useState, useEffect, useRef } from "react";
import type { HomeworkTabKey, HomeworkSummary } from "../types";

import HomeworkHeader from "./common/HomeworkHeader";
import HomeworkTabs from "./common/HomeworkTabs";
import { Button, EmptyState } from "@/shared/ui/ds";
import { useAdminHomework } from "../hooks/useAdminHomework";
import HomeworkSetupPanel from "../panels/HomeworkSetupPanel";
import HomeworkAssetsPanel from "../panels/HomeworkAssetsPanel";
import HomeworkSubmissionsPanel from "../panels/HomeworkSubmissionsPanel";
import HomeworkResultsPanel from "../panels/HomeworkResultsPanel";
import { useAssessmentEditGuard } from "@/shared/ui/assessment/AssessmentEditGuard";

export type HomeworkDetailMode = "design" | "operate";

export default function AdminHomeworkDetail({
  homeworkId,
  sessionId: sessionIdFromRoute,
  mode = "design",
}: {
  homeworkId: number;
  /** URL의 sessionId (상단 차시 이동 경로 유지용) */
  sessionId?: number;
  /** operate 시 3탭(운영|제출관리|결과), design 시 4탭 — 시험과 동일 */
  mode?: HomeworkDetailMode;
}) {
  const [activeTab, setActiveTab] = useState<HomeworkTabKey>("setup");
  const { confirmDiscard } = useAssessmentEditGuard();
  const readErrorRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, isFetching, refetch } = useAdminHomework(homeworkId);

  // homeworkId 변경 시 탭 리셋
  useEffect(() => { setActiveTab("setup"); }, [homeworkId]);

  useEffect(() => {
    if (!isError || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
    readErrorRef.current?.focus({ preventScroll: true });
    readErrorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [isError]);

  if (!Number.isFinite(homeworkId) || homeworkId <= 0) {
    return <EmptyState scope="panel" tone="error" title="과제 ID가 올바르지 않습니다." />;
  }

  if (isLoading) {
    return <EmptyState scope="panel" tone="loading" title="과제 정보 불러오는 중…" />;
  }

  if (!data) {
    return <EmptyState scope="panel" tone="error" title="과제 정보를 불러오지 못했습니다." actions={<Button type="button" intent="secondary" size="lg" className="h-11" disabled={isFetching} onClick={() => void refetch()}>다시 시도</Button>} />;
  }

  const changeTab = (nextTab: HomeworkTabKey) => {
    if (nextTab === activeTab) return;
    void confirmDiscard().then((confirmed) => {
      if (confirmed) setActiveTab(nextTab);
    });
  };

  const primaryAction = mode === "operate"
    ? activeTab === "setup" || activeTab === "assets"
      ? { label: "제출 현황 보기", onClick: () => changeTab("submissions") }
      : activeTab === "submissions"
        ? { label: "결과 보기", onClick: () => changeTab("results") }
        : { label: "운영 설정 보기", onClick: () => changeTab("setup") }
    : undefined;

  const summary: HomeworkSummary = {
    id: data.id,
    title: data.title,
    session_id: data.session_id,
    homework_type: data.homework_type,
    template_homework_id: data.template_homework_id,
  };

  return (
    <div className="space-y-6">
      {isError && <div ref={readErrorRef} role="alert" tabIndex={-1} className="scroll-mt-20 text-sm">
        과제 정보를 다시 확인하지 못했습니다. 현재 입력은 유지하며 확인 전에는 저장할 수 없습니다.
        <Button type="button" intent="secondary" size="lg" className="h-11" disabled={isFetching} onClick={() => void refetch()}>다시 시도</Button>
      </div>}
      <fieldset disabled={isError} className="m-0 min-w-0 space-y-6 border-0 p-0">
      <HomeworkHeader
        readError={isError} readPending={isFetching} onRetryRead={() => void refetch()}
        homework={summary}
        sessionId={sessionIdFromRoute ?? data?.session_id}
        primaryAction={primaryAction}
      />
      <HomeworkTabs
        activeTab={activeTab}
        onChange={changeTab}
        mode={mode}
      />

      {/* design mode: 개별 탭 렌더링 */}
      {mode === "design" && activeTab === "setup" && (
        <HomeworkSetupPanel
          homeworkId={homeworkId}
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
      </fieldset>
    </div>
  );
}
