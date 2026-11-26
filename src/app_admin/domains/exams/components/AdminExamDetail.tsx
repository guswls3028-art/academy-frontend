import { useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { useAdminExam } from "../hooks/useAdminExam";
import type { ExamTabKey } from "../types";

import ExamWorklist from "./ExamWorklist";
import { useAssessmentWorklist } from "@/shared/ui/assessment/useAssessmentWorklist";
import ExamTabs from "./common/ExamTabs";
import ExamHeader from "./common/ExamHeader";
import { Button, EmptyState } from "@/shared/ui/ds";
import { EXAM_ANALYSIS_ANCHOR } from "@/shared/lib/assessmentQueryParams";
import { useLectureSessionParams } from "@/shared/hooks/useLectureSessionParams";
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
  const { data: exam, isLoading, isError, isFetching, refetch } = useAdminExam(examId);
  const { confirmDiscard } = useAssessmentEditGuard();
  const readErrorRef = useRef<HTMLDivElement>(null);
  const wrongCompletionOnly = useWrongCompletionDisplay();
  const [searchParams] = useSearchParams();
  const linkedTab = searchParams.get("examTab");
  const { hash } = useLocation();
  const { lectureId } = useLectureSessionParams();
  const focusAnalysis = linkedTab === "results" && hash.slice(1) === EXAM_ANALYSIS_ANCHOR;
  const worklist = useAssessmentWorklist(`${examId}:${linkedTab ?? ""}:${hash}`,
    linkedTab === "results" ? { step: "results", action: focusAnalysis ? "analysis" : "results" }
      : linkedTab === "setup" ? { step: "policy", action: "settings" }
      : linkedTab === "assets" ? { step: "materials", action: "source" }
      : { step: "submissions", action: linkedTab === "submissions" ? "submissions" : undefined });
  const [tab, setTab] = useState<ExamTabKey>(linkedTab === "results" ? "results" : "setup");

  useEffect(() => {
    setTab(linkedTab === "results" ? "results" : "setup");
  }, [examId, linkedTab]);

  useEffect(() => {
    if (!isError || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
    readErrorRef.current?.focus({ preventScroll: true });
    readErrorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [isError]);

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="시험 정보 불러오는 중…" />;
  if (isError && !exam) return <EmptyState scope="panel" tone="error" title="시험을 불러오지 못했습니다." description="다시 시도해 현재 설정을 확인해 주세요." actions={<Button type="button" intent="secondary" size="lg" className="h-11" disabled={isFetching} onClick={() => void refetch()}>다시 시도</Button>} />;
  if (!exam) return <EmptyState scope="panel" tone="error" title="시험을 불러오지 못했습니다." />;

  const changeTab = (nextTab: ExamTabKey) => {
    if (nextTab === tab) return;
    void confirmDiscard().then((confirmed) => {
      if (confirmed) setTab(nextTab);
    });
  };

  const openMaterials = () => mode === "operate"
    ? void worklist.select({ step: "materials", action: "source" })
    : changeTab("assets");
  const primaryAction = mode === "operate"
    ? worklist.selection.step === "results"
      ? { label: "운영 설정 보기", onClick: () => worklist.select({ step: "policy", action: "settings" }) }
      : worklist.selection.action === "submissions"
        ? { label: "채점·결과 보기", onClick: () => worklist.select({ step: "results", action: "results" }) }
        : { label: "제출 현황 보기", onClick: () => worklist.select({ step: "submissions", action: "submissions" }) }
    : undefined;

  return (
    <div className="space-y-6">
      {isError && <div ref={readErrorRef} role="alert" tabIndex={-1} className="scroll-mt-20 text-sm">
        시험 정보를 다시 확인하지 못했습니다. 현재 입력은 유지하며 확인 전에는 저장할 수 없습니다.
        <Button type="button" intent="secondary" size="lg" className="h-11" disabled={isFetching} onClick={() => void refetch()}>다시 시도</Button>
      </div>}
      <fieldset disabled={isError} className="m-0 min-w-0 space-y-6 border-0 p-0">
      <ExamHeader readError={isError} readPending={isFetching} onRetryRead={() => void refetch()} exam={exam} sessionId={sessionId} primaryAction={primaryAction} />

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
          onClick={openMaterials}
        >
          <strong>문항 자동 분리를 완료하지 못했습니다.</strong>
          <span className="ml-2">원본 파일을 확인하고 다시 올려 주세요.</span>
        </button>
      )}
      {exam.segmentation_status === "review_required" && (
        <button
          type="button"
          className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900"
          onClick={openMaterials}
        >
          <strong>문항과 선생님 원본 해설을 맞춰 두었습니다.</strong>
          <span className="ml-2">번호를 확인하고 확정해야 채점과 오답노트에 반영됩니다.</span>
        </button>
      )}
      {exam.segmentation_status === "conversion_required" && (
        <button
          type="button"
          className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900"
          onClick={openMaterials}
        >
          <strong>자료 원본은 형식 그대로 보관되었습니다.</strong>
          <span className="ml-2">자동 분리가 완전하지 않으면 문항과 해설을 직접 등록해 검수할 수 있습니다.</span>
        </button>
      )}

      {mode === "operate" ? (
        <ExamWorklist exam={exam} sessionId={sessionId} lectureId={lectureId ?? 0}
          selection={worklist.selection} select={worklist.select} wrongCompletionOnly={wrongCompletionOnly}
          focusAnalysis={focusAnalysis} />
      ) : <>
        <ExamTabs activeTab={tab} onChange={changeTab} hasSession assetsReady mode={mode} />
        {tab === "setup" && <ExamSetupPanel examId={examId} />}
        {tab === "assets" && <ExamAssetsPanel examId={examId} />}
        {tab === "submissions" && <ExamSubmissionsPanel examId={examId} sessionId={sessionId} />}
        {tab === "results" && (
          <ExamResultsViewerPanel
            examId={examId}
            sessionId={sessionId ?? undefined}
            wrongCompletionOnly={wrongCompletionOnly}
            focusAnalysis={focusAnalysis}
            initialLectureId={focusAnalysis ? lectureId : undefined}
            onOpenSetup={() => changeTab("setup")}
          />
        )}
      </>}
      </fieldset>
    </div>
  );
}
