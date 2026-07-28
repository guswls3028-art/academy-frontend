import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import WrongNotePanel from "@/app_admin/domains/results/components/WrongNotePanel";
import "@/app_admin/domains/results/components/StudentResultDrawer.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 10_000 },
    mutations: { retry: false },
  },
});

Object.assign(window, { __wrongNoteQueryClient: queryClient });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <WrongNotePanel enrollmentId={7} examId={41} />
    </QueryClientProvider>
  </React.StrictMode>,
);
