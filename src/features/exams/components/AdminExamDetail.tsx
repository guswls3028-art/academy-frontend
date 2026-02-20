import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAdminExam } from "../hooks/useAdminExam";

import ExamTabs from "./common/ExamTabs";
import ExamHeader from "./common/ExamHeader";

import ExamSetupPanel from "../panels/setup/ExamSetupPanel";
import ExamAssetsPanel from "../panels/ExamAssetsPanel";
import ExamSubmissionsPanel from "../panels/ExamSubmissionsPanel";
import ExamResultsViewerPanel from "../panels/ExamResultsViewerPanel";

export type ExamDetailMode = "design" | "operate";

type Props = {
  examId: number;
  mode?: ExamDetailMode;
};

export default function AdminExamDetail({ examId, mode = "design" }: Props) {
  const navigate = useNavigate();
  const { lectureId, sessionId } = useParams<{ lectureId?: string; sessionId?: string }>();
  const { data: exam, isLoading } = useAdminExam(examId);
  const [tab, setTab] = useState<"setup" | "assets" | "submissions" | "results">(
    "setup"
  );

  if (isLoading) return <div>Loading...</div>;
  if (!exam) return <div>시험 없음</div>;

  const backToOpsUrl =
    lectureId && sessionId
      ? `/admin/lectures/${lectureId}/sessions/${sessionId}/exams`
      : null;

  return (
    <div className="space-y-6">
      {mode === "operate" && backToOpsUrl && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(backToOpsUrl)}
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            ← 목록
          </button>
        </div>
      )}
      <ExamHeader exam={exam} />

      <ExamTabs
        activeTab={tab}
        onChange={setTab}
        hasSession={true}
        assetsReady={true}
        mode={mode}
      />

      {tab === "setup" && <ExamSetupPanel examId={examId} />}
      {tab === "assets" && mode === "design" && <ExamAssetsPanel examId={examId} />}
      {tab === "submissions" && <ExamSubmissionsPanel examId={examId} />}
      {tab === "results" && <ExamResultsViewerPanel examId={examId} />}
    </div>
  );
}
