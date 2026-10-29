import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ExamResultExcelImport from "@/app_admin/domains/results/components/ExamResultExcelImport";
import "@/index.css";

const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
function Harness() {
  const [examId, setExamId] = useState(77);
  return <QueryClientProvider client={client}>
    <button onClick={() => setExamId(78)}>다음 시험</button>
    <p>현재 시험 {examId}</p>
    <ExamResultExcelImport examId={examId} examTitle={`시험 ${examId}`} />
  </QueryClientProvider>;
}
ReactDOM.createRoot(document.getElementById("root")!).render(<Harness />);
