import { useState } from "react";
import { useAdminExam } from "../hooks/useAdminExam";

import ExamTabs from "./common/ExamTabs";
import ExamHeader from "./common/ExamHeader";
import { EmptyState } from "@/shared/ui/ds";

import ExamSetupPanel from "../panels/setup/ExamSetupPanel";
import ExamAssetsPanel from "../panels/ExamAssetsPanel";
import ExamResultsViewerPanel from "../panels/ExamResultsViewerPanel";

export type ExamDetailMode = "design" | "operate";

type Props = {
  examId: number;
  mode?: ExamDetailMode;
  sessionId?: number | null;
};

export default function AdminExamDetail({ examId, mode = "design", sessionId }: Props) {
  const { data: exam, isLoading } = useAdminExam(examId);
  const [tab, setTab] = useState<"setup" | "assets" | "results">(
    "setup"
  );

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="시험 정보 불러오는 중…" />;
  if (!exam) return <EmptyState scope="panel" tone="error" title="시험을 불러오지 못했습니다." />;

  return (
    <div className="space-y-6">
      <ExamHeader exam={exam} sessionId={sessionId} />

      <ExamTabs
        activeTab={tab}
        onChange={setTab}
        hasSession={true}
        assetsReady={true}
        mode={mode}
      />

      {tab === "setup" && <ExamSetupPanel examId={examId} />}
      {tab === "assets" && mode === "design" && <ExamAssetsPanel examId={examId} />}
      {tab === "results" && <ExamResultsViewerPanel examId={examId} />}
    </div>
  );
}
