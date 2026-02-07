// PATH: src/main.tsx
// --------------------------------------------------
// App Entry Point (FINAL)
//
// - Global CSS는 src/index.css 단일 진입
// - Design System SSOT 기반
// - legacy styles / globals.css 완전 제거
// --------------------------------------------------

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import AppRouter from "@/app/router/AppRouter";
import QueryProvider from "@/app/providers/QueryProvider";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";

/**
 * ✅ Global Style Entry (SSOT)
 * - src/index.css
 * - 내부에서 design-system/index.css 로 연결됨
 */
import "./index.css";

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
