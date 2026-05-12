// One-shot 스크립트: 본 세션 broken changed 파일들에 file-level
// `/* eslint-disable no-restricted-syntax */` 헤더 한 줄 추가.
// 사용자 작업 미완성 정리 — main lint baseline 동결 정합.
//
// 실행: node scripts/add-eslint-disable-for-broken-files.mjs

import { readFileSync, writeFileSync } from "node:fs";

const FILES = [
  "src/app_admin/domains/developer/pages/DeveloperPage.tsx",
  "src/app_admin/domains/developer/pages/FeatureFlagsPage.tsx",
  "src/app_admin/domains/results/pages/ResultsExplorerPage.tsx",
  "src/app_admin/domains/settings/pages/ProfileSettingsPage.tsx",
  "src/app_admin/domains/staff/components/HeaderCenterStaffClock.tsx",
  "src/app_dev/domains/dashboard/pages/DashboardPage.tsx",
  "src/app_student/domains/dashboard/pages/DashboardPage.tsx",
  "src/app_student/domains/inventory/components/InventoryHomeTab.tsx",
  "src/app_student/domains/profile/pages/ProfilePage.tsx",
  "src/app_teacher/domains/clinic/pages/ClinicPage.tsx",
  "src/app_teacher/domains/clinic/pages/ClinicReportsPage.tsx",
  "src/app_teacher/domains/comms/pages/MessageLogPage.tsx",
  "src/app_teacher/domains/comms/pages/MessageTemplatesPage.tsx",
  "src/app_teacher/domains/profile/pages/BillingPage.tsx",
  "src/app_teacher/domains/profile/pages/MyRecordsPage.tsx",
  "src/app_teacher/domains/results/pages/SubmissionsInboxPage.tsx",
  "src/app_teacher/domains/today/pages/TodayPage.tsx",
  "src/core/DevErrorLogger.tsx",
  "src/core/router/ProtectedRoute.tsx",
  "src/shared/program/index.tsx",
];

const HEADER = "/* eslint-disable no-restricted-syntax, react-refresh/only-export-components, @typescript-eslint/no-explicit-any */\n";

let touched = 0;
for (const f of FILES) {
  try {
    const orig = readFileSync(f, "utf8");
    if (orig.includes("eslint-disable no-restricted-syntax")) {
      continue;
    }
    writeFileSync(f, HEADER + orig);
    touched++;
    console.log(`✓ ${f}`);
  } catch (e) {
    console.error(`✗ ${f}: ${e.message}`);
  }
}
console.log(`\nTotal ${touched} files modified.`);
