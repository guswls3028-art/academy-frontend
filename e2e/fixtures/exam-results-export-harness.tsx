import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router";

import ExamResultsViewerPanel from "@/app_admin/domains/exams/panels/ExamResultsViewerPanel";
import "@/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <main className="mx-auto max-w-6xl p-4">
          <ExamResultsViewerPanel examId={77} />
        </main>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
