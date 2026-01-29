// PATH: src/features/sessions/routes.tsx

import { RouteObject } from "react-router-dom";

import SessionLayout from "./layout/SessionLayout";

// 탭 라우트들
import SessionAttendanceRoute from "./routes/SessionAttendanceRoute";
import SessionExamsRoute from "./routes/SessionExamsRoute";
import SessionScoresRoute from "./routes/SessionScoresRoute";
import SessionAssignmentsRoute from "./routes/SessionAssignmentsRoute";
import SessionVideosRoute from "./routes/SessionVideosRoute";

/**
 * ✅ Session Feature Routes
 * - 원본 구조 유지: layout/ + routes/ 하위 탭 라우트
 * - UI/UX 계약은 SessionTabs에서 제어, 여기서는 라우팅만 담당
 */
export const sessionRoutes: RouteObject[] = [
  {
    path: "sessions/:sessionId",
    element: <SessionLayout />,
    children: [
      { index: true, element: <SessionAttendanceRoute /> }, // 기본 진입 탭(원본 존중)
      { path: "attendance", element: <SessionAttendanceRoute /> },
      { path: "exams", element: <SessionExamsRoute /> },
      { path: "assignments", element: <SessionAssignmentsRoute /> },
      { path: "scores", element: <SessionScoresRoute /> },
      { path: "videos", element: <SessionVideosRoute /> },
    ],
  },
];
