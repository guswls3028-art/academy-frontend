// PATH: src/features/homework/components/AdminHomeworkDetail.tsx
/**
 * AdminHomeworkDetail
 *
 * ✅ 시험 UX 100% 복제
 * 탭: setup / assets / submissions / results
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
import { useAdminHomework } from "../hooks/useAdminHomework";
import HomeworkSetupPanel from "../panels/HomeworkSetupPanel";
import HomeworkAssetsPanel from "../panels/HomeworkAssetsPanel";
import HomeworkSubmissionsPanel from "../panels/HomeworkSubmissionsPanel";
import HomeworkResultsPanel from "../panels/HomeworkResultsPanel";

export default function AdminHomeworkDetail({ homeworkId }: { homeworkId: number }) {
  const [activeTab, setActiveTab] = useState<HomeworkTabKey>("setup");
  const { data, isLoading, isError } = useAdminHomework(homeworkId);

  if (!Number.isFinite(homeworkId) || homeworkId <= 0) {
    return (
      <div className="rounded border bg-yellow-50 p-4 text-sm text-yellow-800">
        homeworkId가 올바르지 않습니다.
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-sm text-gray-500">과제 정보 불러오는 중...</div>;
  }

  if (isError || !data) {
    return <div className="text-sm text-red-600">과제 정보를 불러오지 못했습니다.</div>;
  }

  const summary: HomeworkSummary = {
    id: data.id,
    title: data.title,
    status: data.status,
  };

  return (
    <div className="space-y-6">
      <HomeworkHeader homework={summary} />
      <HomeworkTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "setup" && <HomeworkSetupPanel homeworkId={homeworkId} />}
      {activeTab === "assets" && <HomeworkAssetsPanel homeworkId={homeworkId} />}
      {activeTab === "submissions" && <HomeworkSubmissionsPanel homeworkId={homeworkId} />}
      {activeTab === "results" && <HomeworkResultsPanel homeworkId={homeworkId} />}
    </div>
  );
}
