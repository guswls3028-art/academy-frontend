// PATH: src/features/students/StudentsRoutes.tsx
import { Routes, Route, Navigate } from "react-router-dom";

import StudentsLayout from "./StudentsLayout";

import StudentsHomePage from "./pages/StudentsHomePage";
import StudentsHistoryPage from "./pages/StudentsHistoryPage";
import StudentsScoresPage from "./pages/StudentsScoresPage";
import StudentDetailOverlay from "./overlays/StudentDetailOverlay";

export default function StudentsRoutes() {
  return (
    <Routes>
      <Route element={<StudentsLayout />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<StudentsHomePage />} />
        <Route path="history" element={<StudentsHistoryPage />} />
        <Route path="scores" element={<StudentsScoresPage />} />
      </Route>

      {/* 학생 상세는 Overlay (직원과 동일 패턴) */}
      <Route path=":studentId/*" element={<StudentDetailOverlay />} />
    </Routes>
  );
}
