import { useEffect, useState } from "react";
import { useAdminExam } from "../hooks/useAdminExam";
import type { ExamTabKey } from "../types";

import ExamTabs from "./common/ExamTabs";
import ExamHeader from "./common/ExamHeader";
import { EmptyState } from "@/shared/ui/ds";
import { useAssessmentEditGuard } from "@/shared/ui/assessment/AssessmentEditGuard";
import { useWrongCompletionDisplay } from "@/shared/scoring/assessmentStatusDisplay";

import ExamSetupPanel from "../panels/setup/ExamSetupPanel";
import ExamAssetsPanel from "../panels/ExamAssetsPanel";
import ExamResultsViewerPanel from "../panels/ExamResultsViewerPanel";
import ExamSubmissionsPanel from "../panels/ExamSubmissionsPanel";

export type ExamDetailMode = "design" | "operate";

type Props = {
  examId: number;
  mode?: ExamDetailMode;
  sessionId?: number | null;
};

export default function AdminExamDetail({ examId, mode = "design", sessionId }: Props) {
  const { data: exam, isLoading, isError, refetch } = useAdminExam(examId);
  const { confirmDiscard } = useAssessmentEditGuard();
  const wrongCompletionOnly = useWrongCompletionDisplay();
  const [tab, setTab] = useState<ExamTabKey>("setup");

  useEffect(() => {
    setTab("setup");
  }, [examId]);

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="시험 정보 불러오는 중…" />;
  if (isError) return <EmptyState scope="panel" tone="error" title="시험을 불러오지 못했습니다." description="이전 값으로 수정하지 않도록 시험 작업을 잠갔습니다." actions={<button type="button" onClick={() => void refetch()}>다시 시도</button>} />;
  if (!exam) return <EmptyState scope="panel" tone="error" title="시험을 불러오지 못했습니다." />;

  const changeTab = (nextTab: ExamTabKey) => {
    if (nextTab === tab) return;
    void confirmDiscard().then((confirmed) => {
      if (confirmed) setTab(nextTab);
    });
  };

  const primaryAction = mode === "operate"
    ? tab === "setup" || tab === "assets"
      ? { label: "제출 현황 보기", onClick: () => changeTab("submissions") }
      : tab === "submissions"
        ? { label: "채점·결과 보기", onClick: () => changeTab("results") }
        : { label: "운영 설정 보기", onClick: () => changeTab("setup") }
    : undefined;

  return (
    <div className="space-y-6">
      <ExamHeader exam={exam} sessionId={sessionId} primaryAction={primaryAction} />

      {exam.segmentation_status === "processing" && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800" role="status">
          <strong>시험지에서 문항 이미지를 분리하고 있습니다.</strong>
          <span className="ml-2">완료되면 문항·답안 설정에서 번호와 배점을 확인해 주세요.</span>
        </div>
      )}
      {exam.segmentation_status === "failed" && (
        <button
          type="button"
          className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-800"
          onClick={() => setTab(mode === "design" ? "assets" : "setup")}
        >
          <strong>문항 자동 분리를 완료하지 못했습니다.</strong>
          <span className="ml-2">원본 파일을 확인하고 다시 올려 주세요.</span>
        </button>
      )}
      {exam.segmentation_status === "review_required" && (
        <button
          type="button"
          className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900"
          onClick={() => setTab(mode === "design" ? "assets" : "setup")}
        >
          <strong>문항과 선생님 원본 해설을 맞춰 두었습니다.</strong>
          <span className="ml-2">번호를 확인하고 확정해야 채점과 오답노트에 반영됩니다.</span>
        </button>
      )}
      {exam.segmentation_status === "conversion_required" && (
        <button
          type="button"
          className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900"
          onClick={() => setTab(mode === "design" ? "assets" : "setup")}
        >
          <strong>자료 원본은 형식 그대로 보관되었습니다.</strong>
          <span className="ml-2">자동 분리가 완전하지 않으면 문항과 해설을 직접 등록해 검수할 수 있습니다.</span>
        </button>
      )}

      <ExamTabs
        activeTab={tab}
        onChange={changeTab}
        hasSession={true}
        assetsReady={true}
        mode={mode}
      />

      {tab === "setup" && (
        <div className="space-y-6">
          <ExamSetupPanel examId={examId} />
          {/* operate(세션 컨텍스트)에서는 자산도 '운영'에 함께 담아서 과제와 동일한 톤 */}
          {mode === "operate" && <ExamAssetsPanel examId={examId} />}
        </div>
      )}
      {tab === "assets" && mode === "design" && <ExamAssetsPanel examId={examId} />}
      {tab === "submissions" && <ExamSubmissionsPanel examId={examId} sessionId={sessionId} />}
      {tab === "results" && (
        <ExamResultsViewerPanel examId={examId} wrongCompletionOnly={wrongCompletionOnly} />
      )}
    </div>
  );
}
