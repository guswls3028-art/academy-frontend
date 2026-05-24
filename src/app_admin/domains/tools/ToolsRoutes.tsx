// PATH: src/app_admin/domains/tools/ToolsRoutes.tsx
// 도구 라우트 — lazy 로딩

import { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";
import styles from "./ToolsRoutes.module.css";

const ToolsLayout = lazy(() => import("./ToolsLayout"));
const PptGeneratorPage = lazy(() => import("./ppt/pages/PptGeneratorPage"));
const OmrGeneratorPage = lazy(() => import("./omr/pages/OmrGeneratorPage"));
const ClinicPrintoutPage = lazy(() => import("./clinic/pages/ClinicPrintoutPage"));
const StopwatchPage = lazy(() => import("./stopwatch/pages/StopwatchPage"));
const ProblemStudioPage = lazy(() => import("./problem-studio/pages/ProblemStudioPage"));

function Fallback() {
  return (
    <div className={styles.fallback}>
      불러오는 중…
    </div>
  );
}

export default function ToolsRoutes() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route element={<ToolsLayout />}>
          <Route index element={<Navigate to="ppt" replace />} />
          <Route path="ppt" element={<Suspense fallback={<Fallback />}><PptGeneratorPage /></Suspense>} />
          <Route path="omr" element={<Suspense fallback={<Fallback />}><OmrGeneratorPage /></Suspense>} />
          <Route path="clinic" element={<Suspense fallback={<Fallback />}><ClinicPrintoutPage /></Suspense>} />
          <Route path="stopwatch" element={<Suspense fallback={<Fallback />}><StopwatchPage /></Suspense>} />
          <Route path="problem-studio" element={<Suspense fallback={<Fallback />}><ProblemStudioPage /></Suspense>} />
        </Route>
      </Routes>
    </Suspense>
  );
}
