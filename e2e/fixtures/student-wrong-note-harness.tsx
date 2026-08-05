import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import StudentWrongNoteBuilder from "@/app_admin/domains/results/components/StudentWrongNoteBuilder";
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
      <StudentWrongNoteBuilder studentId={77} />
    </QueryClientProvider>
  </React.StrictMode>,
);
