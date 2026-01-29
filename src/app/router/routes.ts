// src/app/router/routes.ts

import StudentsPage from "@/features/students/pages/StudentsPage";
import StudentsDetailPage from "@/features/students/pages/StudentsDetailPage";

export const routes = [
  { path: "/students", element: <StudentsPage /> },
  { path: "/students/:id", element: <StudentsDetailPage /> },
];
