// PATH: src/app_admin/domains/students/StudentsRoutes.tsx
// NOTE: 실제 라우팅은 AdminRouter.tsx에서 처리. 이 파일은 레거시 참조용.
import { Routes, Route, Navigate } from "react-router-dom";

import StudentsLayout from "./StudentsLayout";

import StudentsHomePage from "./pages/StudentsHomePage";
import StudentsRequestsPage from "./pages/StudentsRequestsPage";
import StudentsDetailOverlay from "./overlays/StudentsDetailOverlay";

export default function StudentsRoutes() {
  return (
    <Routes>
      <Route element={<StudentsLayout />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<StudentsHomePage />} />
        <Route path="requests" element={<StudentsRequestsPage />} />
        <Route path="deleted" element={<StudentsHomePage />} />
      </Route>

      {/* 학생 상세는 Overlay (직원과 동일 패턴) */}
      <Route path=":studentId/*" element={<StudentsDetailOverlay />} />
    </Routes>
  );
}
