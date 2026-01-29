// src/student/app/StudentApp.tsx
/**
 * ✅ StudentApp (LOCK v1)
 * - 학생 앱 진입점
 * - Router만 렌더링
 *
 * 원칙:
 * - student는 features를 "사용"만 가능
 * - features → student 참조는 절대 금지
 */

import StudentRouter from "@/student/app/StudentRouter";

export default function StudentApp() {
  return <StudentRouter />;
}
