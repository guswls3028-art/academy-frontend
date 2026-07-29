import { useEffect, useState } from "react";
import { useAdminExam } from "../hooks/useAdminExam";

import ExamTabs from "./common/ExamTabs";
import ExamHeader from "./common/ExamHeader";
import { EmptyState } from "@/shared/ui/ds";

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
  const { data: exam, isLoading } = useAdminExam(examId);
  const [tab, setTab] = useState<"setup" | "assets" | "submissions" | "results">(
    "setup"
  );

  useEffect(() => {
    setTab("setup");
  }, [examId]);

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="시험 정보 불러오는 중…" />;
  if (!exam) return <EmptyState scope="panel" tone="error" title="시험을 불러오지 못했습니다." />;

  return (
    <div className="space-y-6">
      <ExamHeader exam={exam} sessionId={sessionId} />

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
      {exam.segmentation_status === "conversion_required" && (
        <button
          type="button"
          className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900"
          onClick={() => setTab(mode === "design" ? "assets" : "setup")}
        >
          <strong>HWP 원본은 보관되었습니다.</strong>
          <span className="ml-2">수식과 쪽 배치를 보존하도록 PDF로 저장해 추가로 올려 주세요.</span>
        </button>
      )}

      <ExamTabs
        activeTab={tab}
        onChange={setTab}
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
      {tab === "results" && <ExamResultsViewerPanel examId={examId} />}
    </div>
  );
}
