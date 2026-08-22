export const productionReadOnlySpecs = [
  "e2e/shared/e2e-safety-policy.spec.ts",
  "e2e/admin/01-login-dashboard.spec.ts",
  "e2e/student/01-login-dashboard.spec.ts",
  "e2e/smoke/smoke.spec.ts",
];

export const routeMockSpecs = [
  "e2e/admin/workspace-quick-navigation.mock.spec.ts",
  "e2e/admin/dev-console-enterprise.mock.spec.ts",
  "e2e/admin/dev-console-owner-safety.mock.spec.ts",
  "e2e/refactor/landing-router.spec.ts",
  "e2e/auth/account-password-flows.mock.spec.ts",
  "e2e/auth/account-recovery-modal.spec.ts",
  "e2e/auth/first-login-guide.mock.spec.ts",
  "e2e/auth/godmin-login-visual.mock.spec.ts",
  "e2e/auth/staff-clock-in-choice.mock.spec.ts",
  "e2e/admin/arrival-operations.mock.spec.ts",
  "e2e/admin/billing-bank-transfer-only.mock.spec.ts",
  "e2e/admin/assessment-operations-workspace.mock.spec.ts",
  "e2e/admin/clinic-weekly-multisession.mock.spec.ts",
  "e2e/admin/clinic-remediation-missing.mock.spec.ts",
  "e2e/admin/session-clinic-pending.mock.spec.ts",
  "e2e/admin/lecture-session-scopes.mock.spec.ts",
  "e2e/admin/lecture-create-responsive.mock.spec.ts",
  "e2e/admin/manual-exam-grading.mock.spec.ts",
  "e2e/admin/exam-wrong-note-export.mock.spec.ts",
  "e2e/admin/problem-review-report.mock.spec.ts",
  "e2e/admin/matchup-showcase-publish.mock.spec.ts",
  "e2e/landing-problem-analysis.mock.spec.ts",
  "e2e/admin/session-attendance-bulk-safety.mock.spec.ts",
  "e2e/admin/score-entry-autosave.spec.ts",
  "e2e/admin/staff-operations-contract.mock.spec.ts",
  "e2e/admin/stopwatch-visual-runtime.mock.spec.ts",
  "e2e/admin/student-custom-columns.mock.spec.ts",
  "e2e/admin/student-detail-entrypoints.mock.spec.ts",
  "e2e/admin/student-support-preview.mock.spec.ts",
  "e2e/admin/student-unified-wrong-note.mock.spec.ts",
  "e2e/admin/wrong-note-generation-contract.mock.spec.ts",
  "e2e/shared/product-analytics-contract.mock.spec.ts",
  "e2e/student/student-content-resilience.mock.spec.ts",
  "e2e/student/assignment-session-scope.mock.spec.ts",
  "e2e/student/clinic-booking-ux.mock.spec.ts",
  "e2e/student/video-cdn-service-error.mock.spec.ts",
  "e2e/student/numeric-short-answer.spec.ts",
  "e2e/teacher/comms-reply-mobile.mock.spec.ts",
  "e2e/teacher/teacher-business-workflow.mock.spec.ts",
  "e2e/teacher/messaging-settings-clear-timing.mock.spec.ts",
  "e2e/teacher/video-thumbnail-render.mock.spec.ts",
];

export const criticalInteractionSpecs = [
  "e2e/admin/lecture-create-responsive.mock.spec.ts",
  "e2e/auth/account-password-flows.mock.spec.ts",
  "e2e/auth/staff-clock-in-choice.mock.spec.ts",
  "e2e/admin/student-support-preview.mock.spec.ts",
];

export const criticalStateTransitionSpecs = [
  "e2e/admin/assessment-operations-workspace.mock.spec.ts",
  "e2e/admin/score-entry-autosave.spec.ts",
  "e2e/student/numeric-short-answer.spec.ts",
  "e2e/teacher/messaging-settings-clear-timing.mock.spec.ts",
];

export const e2eGateSpecs = [
  ...productionReadOnlySpecs,
  ...routeMockSpecs,
];
