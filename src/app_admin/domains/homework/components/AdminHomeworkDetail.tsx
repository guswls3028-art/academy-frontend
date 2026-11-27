import { useState, useEffect, useRef } from "react";
import type { HomeworkTabKey, HomeworkSummary } from "../types";

import HomeworkHeader from "./common/HomeworkHeader";
import HomeworkWorklist from "./HomeworkWorklist";
import { useHomeworkAssignments } from "../hooks/useHomeworkAssignments";
import { initialAssessmentStep, useAssessmentWorklist } from "@/shared/ui/assessment/useAssessmentWorklist";
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
  mode?: HomeworkDetailMode;
}) {
  const [activeTab, setActiveTab] = useState<HomeworkTabKey>("setup");
  const { confirmDiscard } = useAssessmentEditGuard();
  const readErrorRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, isFetching, refetch } = useAdminHomework(homeworkId);
  const assignments = useHomeworkAssignments(mode === "operate" ? homeworkId : 0);
  const audienceCount = assignments.isSuccess && Array.isArray(assignments.data?.selected_ids)
    ? assignments.data.selected_ids.length : undefined;
  const audienceSummary = audienceCount !== undefined ? `배정 학생 ${audienceCount}명`
    : assignments.isPending ? "대상 학생 확인 중" : "대상 학생 조회 실패";
  const worklist = useAssessmentWorklist(String(homeworkId), initialAssessmentStep(audienceCount, data?.source_status));

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
    ? worklist.selection.step === "results"
      ? { label: "운영 설정 보기", onClick: () => worklist.select({ step: "policy", action: "settings" }) }
      : worklist.selection.action === "submissions"
        ? { label: "결과 보기", onClick: () => worklist.select({ step: "results", action: "results" }) }
        : { label: "제출 현황 보기", onClick: () => worklist.select({ step: "submissions", action: "submissions" }) }
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
      {mode === "operate" ? (
        <HomeworkWorklist homework={data} audience={audienceSummary} selection={worklist.selection} select={worklist.select} disabled={isError} />
      ) : <>
        <HomeworkTabs activeTab={activeTab} onChange={changeTab} mode={mode} />
        {activeTab === "setup" && <HomeworkSetupPanel homeworkId={homeworkId} />}
        {activeTab === "assets" && <HomeworkAssetsPanel homeworkId={homeworkId} />}
        {activeTab === "submissions" && <HomeworkSubmissionsPanel homeworkId={homeworkId} />}
        {activeTab === "results" && <HomeworkResultsPanel homeworkId={homeworkId} />}
      </>}
      </fieldset>
    </div>
  );
}
