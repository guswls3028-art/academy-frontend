import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider, useQueries } from "@tanstack/react-query";
import ExamResultExcelImport from "@/app_admin/domains/results/components/ExamResultExcelImport";
import { adminExamsQueryKeys } from "@/app_admin/domains/exams/queryKeys";
import { adminResultsQueryKeys } from "@/app_admin/domains/results/queryKeys";
import { scoresQueryKeys } from "@/app_admin/domains/scores/api/queryKeys";
import "@/index.css";

const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
function CachedResults({ examId }: { examId: number }) {
  const views = [
    { name: "all-results", key: adminExamsQueryKeys.adminExamResults(examId) },
    { name: "lecture-results", key: adminExamsQueryKeys.adminExamResults(examId, 12) },
    { name: "all-stats", key: adminExamsQueryKeys.examQuestionStats(examId) },
    { name: "lecture-stats", key: adminExamsQueryKeys.examQuestionStats(examId, 12) },
    { name: "student-detail", key: adminResultsQueryKeys.adminExamDetail(examId, 901) },
    { name: "manual-sheet", key: adminResultsQueryKeys.manualGradeSheet(examId) },
    { name: "session-scores", key: scoresQueryKeys.sessionScores(44) },
    { name: "other-exam", key: adminExamsQueryKeys.adminExamResults(999) },
  ];
  const queries = useQueries({ queries: views.map(view => ({
    queryKey: view.key,
    queryFn: async () => {
      const response = await fetch(`/__excel-cache-probe/${view.name}`);
      if (!response.ok) throw new Error("Synthetic result read failed");
      return response.json() as Promise<{ score: number }>;
    },
    staleTime: Infinity,
  })) });
  return <section aria-label="연결된 결과 조회">
    {views.map((view, index) => <p key={view.name} data-testid={view.name}>
      {queries[index].data?.score ?? "불러오는 중"}
    </p>)}
  </section>;
}
export function Harness() {
  const [examId, setExamId] = useState(77);
  return <QueryClientProvider client={client}>
    <button onClick={() => setExamId(78)}>다음 시험</button>
    <p>현재 시험 {examId}</p>
    <ExamResultExcelImport examId={examId} examTitle={`시험 ${examId}`} />
    {new URLSearchParams(location.search).has("cacheProbe") && <CachedResults examId={examId} />}
  </QueryClientProvider>;
}
ReactDOM.createRoot(document.getElementById("root")!).render(<Harness />);
