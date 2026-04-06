#!/usr/bin/env node
/**
 * 학생앱 라우트 검증 — StudentRouter에서 lazy 로드하는 모든 페이지 파일이 존재하는지 확인.
 * 사용: frontend 루트에서 node scripts/verify-student-routes.mjs
 * CI에서 빌드 후 실행해 파이프라인 정상 여부를 빠르게 점검할 수 있음.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcRoot = path.join(root, "src");

/** StudentRouter.tsx 의 lazy(() => import(...)) 대상과 동기화 */
const STUDENT_LAZY_PATHS = [
  "student/domains/dashboard/pages/DashboardPage.tsx",
  "student/domains/video/pages/VideoHomePage.tsx",
  "student/domains/video/pages/CourseDetailPage.tsx",
  "student/domains/video/pages/SessionDetailPage.tsx",
  "student/domains/video/pages/VideoPlayerPage.tsx",
  "student/domains/sessions/pages/SessionListPage.tsx",
  "student/domains/sessions/pages/SessionDetailPage.tsx",
  "student/domains/exams/pages/ExamListPage.tsx",
  "student/domains/exams/pages/ExamDetailPage.tsx",
  "student/domains/exams/pages/ExamSubmitPage.tsx",
  "student/domains/exams/pages/ExamResultPage.tsx",
  "student/domains/submit/pages/SubmitHubPage.tsx",
  "student/domains/submit/pages/SubmitScorePage.tsx",
  "student/domains/submit/pages/SubmitAssignmentPage.tsx",
  "student/domains/inventory/pages/MyInventoryPage.tsx",
  "student/domains/grades/pages/GradesPage.tsx",
  "student/domains/more/pages/MorePage.tsx",
  "student/domains/profile/pages/ProfilePage.tsx",
  "student/domains/community/pages/CommunityPage.tsx",
  "student/domains/notices/pages/NoticesPage.tsx",
  "student/domains/notices/pages/NoticeDetailPage.tsx",
  "student/domains/notifications/pages/NotificationsPage.tsx",
  "student/domains/clinic-idcard/pages/ClinicIDCardPage.tsx",
  "student/domains/clinic/pages/ClinicPage.tsx",
  "student/domains/attendance/pages/AttendancePage.tsx",
  "student/domains/settings/pages/StudentSettingsPage.tsx",
  "student/domains/guide/pages/GuidePage.tsx",
];

let failed = 0;
for (const rel of STUDENT_LAZY_PATHS) {
  const full = path.join(srcRoot, rel);
  const exists = fs.existsSync(full);
  if (!exists) {
    console.error(`[FAIL] missing: ${rel}`);
    failed++;
  } else {
    console.log(`[OK] ${rel}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} route(s) missing. Pipeline check failed.`);
  process.exit(1);
}

console.log(`\nAll ${STUDENT_LAZY_PATHS.length} student app route files present.`);
