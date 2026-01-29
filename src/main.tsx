// PATH: src/main.tsx
// --------------------------------------------------
// App Entry Point
//
// - 전역 CSS 엔트리를 styles/index.css 로 통합
// - Tailwind + tokens + base + layout + components
//   전부 여기서 한 번만 로드됨
// - legacy globals.css 사용 중단
// --------------------------------------------------

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import AppRouter from "@/app/router/AppRouter";
import QueryProvider from "@/app/providers/QueryProvider";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";

/**
 * ✅ Global Style Entry
 * - src/styles/index.css 가 단일 진입점
 * - tokens / base / layout / components / animations 포함
 */
import "@/styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <QueryProvider>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </QueryProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
