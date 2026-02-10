// PATH: src/main.tsx
// --------------------------------------------------
// App Entry Point (FINAL / BACKEND-ALIGNED)
//
// - Backend Core SSOT compliant
// - Host-based tenant resolution
// - Program (/core/program) is the first-class citizen
// --------------------------------------------------

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import AppRouter from "@/app/router/AppRouter";
import QueryProvider from "@/app/providers/QueryProvider";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import { ProgramProvider } from "@/shared/program";
import { ThemeProvider } from "@/context/ThemeContext";

import "./index.css";                 // ✅ Tailwind + DS 단일 진입
import "antd/dist/reset.css";         // ✅ AntD reset
// ❌ 여기서 DS css 다시 import 하면 안 됨

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <QueryProvider>
          {/* 🔒 Program is resolved BEFORE auth & routing */}
          <ProgramProvider>
            <AuthProvider>
              <AppRouter />
            </AuthProvider>
          </ProgramProvider>
        </QueryProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
