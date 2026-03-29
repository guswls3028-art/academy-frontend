// PATH: src/features/tools/ToolsRoutes.tsx
// 도구 라우트 — lazy 로딩

import { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";

const ToolsLayout = lazy(() => import("./ToolsLayout"));
const PptGeneratorPage = lazy(() => import("./ppt/pages/PptGeneratorPage"));
const OmrGeneratorPage = lazy(() => import("./omr/pages/OmrGeneratorPage"));
const ClinicPrintoutPage = lazy(() => import("./clinic/pages/ClinicPrintoutPage"));

function Fallback() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: "var(--color-text-secondary)", fontSize: 14 }}>
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
        </Route>
      </Routes>
    </Suspense>
  );
}
