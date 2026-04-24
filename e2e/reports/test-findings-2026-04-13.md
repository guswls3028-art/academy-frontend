# Test Findings Report

> Date: 2026-04-13
> Tester: Cursor Agent
> Environment: Local dev (localhost:5174 + localhost:8000)
> Tenant: 1 (hakwonplus)

## Summary

| Phase | Duration | Findings | Critical | High | Medium | Low |
|-------|----------|----------|----------|------|--------|-----|
| 1. Build Health | ~6m | 793+ (TS lines) + 백엔드/번들 이슈 | 0 | 2 | 4 | 4 |
| 2. API Contract | ~45m | 30+ | 1 | 3 | 14 | 10 |
| 3. Tenant Isolation | ~25m | 12+ | 0 | 2 | 5 | 5 |
| 4. Frontend Runtime (E2E) | ~1.7h | 112 failed · 353 pass · 28 skip · 128 n/a | 0 | 4 | 12 | 96 |
| 5. Data Integrity | ~5m | 7 checks + 플래그·중복 | 0 | 0 | 3 | 4 |
| 6. UX Consistency | ~15m | 48 admin pages 스캔 | 0 | 0 | 8 | 40 |
| 7. Edge Cases | ~25m | 7a 150·7b 5·7c 검증·7d grep | 0 | 1 | 6 | 18 |
| 8. Performance | ~1m + build 45s | 8a 10·8b 31·8c 1790·8e 청크 | 0 | 0 | 10 | 6 |
| 9. Dead Code | ~3m | 10 (Knip·뷰·depcheck) | 0 | 0 | 2 | 6 |
| 10. Security | ~12m | 24 (시크릿·CORS·SQL·XSS·인증·업로드) | 0 | 0 | 2 | 3 |
| **TOTAL** | **>3h** | **Phase별 누적 (중복 제목 아님)** | **1** | **12** | **66** | **192** |

## Critical/High Findings (fix first)

### Critical (1)

| Evidence | File (approx.) | Why |
|----------|----------------|-----|
| `cannot import name 'Enrollment' from 'apps.domains.lectures.models'` — `lectures.filters` 모듈이 로드되지 않음 (Phase 1e import walk) | `backend/apps/domains/lectures/filters.py` (import) | 필터를 쓰는 강의/목록 API·프론트 계약 점검이 불가능하고, 런타임에서 `ImportError` 위험 |

### High (12)

| # | Evidence | File (approx.) | Source phase |
|---|----------|----------------|--------------|
| 1 | `No module named 'apps.domains.progress.tasks'` — grader가 비동기 채점 태스크 모듈을 참조 | `backend/apps/domains/results/services/grader.py` | 1e / 2 |
| 2 | `No module named 'google'` — AI dispatcher / OCR 경로 import 실패 | `apps/worker/ai_worker/ai/pipelines/dispatcher.py`, `ai/ocr/google.py` 등 | 1e |
| 3 | `No module named 'pytesseract'` — OCR 대체 경로 import 실패 | `apps/worker/ai_worker/ai/ocr/tesseract.py` | 1e |
| 4 | `Exam.objects.get(id=int(exam_id))` 에 tenant 조건 없음 (템플릿 여부 분기만) | `backend/apps/domains/exams/views/pdf_question_extract_view.py:53` | 3 |
| 5 | `Exam.objects.get(id=exam_id)` 단독 조회 후 하위 `ExamQuestion` 쿼리에서만 테넌트 필터 | `backend/apps/domains/exams/views/exam_questions_by_exam_view.py:28` | 3 |
| 6 | `makemigrations --check` 실패 — `billing` 앱 미적용 마이그레이션 `0005_...` 존재 | `apps/billing/migrations/` (Phase 1d 로그) | 1d |
| 7 | `check --deploy` **security.W009** — `SECRET_KEY` 길이·엔트로피 부족 경고 (로컬 `dev` 기준) | `backend/apps/api/config/settings/base.py` 등 | 1c |
| 8 | Playwright 실패 #82 — 비밀번호 찾기: 서버 에러 메시지 미노출 | `e2e/auth/password-reset-modal.spec.ts` | 4 |
| 9 | Playwright 실패 #97 — 클리닉 정상 로드 시 콘솔/에러 assertion 불일치 | `e2e/stability/final-edge-verify.spec.ts` | 4 |
| 10 | Playwright 실패 #98 — 네트워크 차단 시 에러 UI 기대 불일치 | 동일 | 4 |
| 11 | Playwright 실패 #99 — 학생 토큰으로 관리자 API 호출 시 403 기대 불일치 | 동일 | 4 |
| 12 | `location = serializers.CharField()` — `max_length`/validators 휴리스틱 미충족 (쓰기 입력 경계) | `backend/apps/domains/clinic/serializers.py:292` | 7a |

---

## All Findings by Phase

## Phase 1: Build Health
Started: 2026-04-13 (로컬 재실행) | Finished: 동일 세션

### Unique `error TS` codes (이번 실행)
- **TS6305** — `.d.ts`가 소스에서 빌드되지 않음 (다수 파일)
- **TS6306** — `tsconfig.app.json`에 `composite`: true 필요 (`tsconfig.json` 참조)
- **TS6310** — 참조 프로젝트가 emit 비활성화 (`tsconfig.json`(3,5))

### 1a. TypeScript — `pnpm tsc --noEmit` (exit 2)
`error TS` 줄 수: **783**

```text
error TS6305: Output file 'C:/academy/frontend/src/app_admin/app/AdminRouter.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/app/AdminRouter.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/admin-notifications/api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/admin-notifications/api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/admin-notifications/index.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/admin-notifications/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/admin-notifications/useAdminNotificationCounts.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/admin-notifications/useAdminNotificationCounts.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/ClinicLayout.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/ClinicLayout.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/ClinicRoutes.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/ClinicRoutes.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/api/clinicLinks.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/api/clinicLinks.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/api/clinicMe.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/api/clinicMe.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/api/clinicParticipants.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/api/clinicParticipants.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/api/clinicSessions.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/api/clinicSessions.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/api/clinicSettings.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/api/clinicSettings.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/api/clinicStudents.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/api/clinicStudents.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/api/clinicTargets.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/api/clinicTargets.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/components/ClinicCreatePanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/components/ClinicCreatePanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/components/ClinicPasscardModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/components/ClinicPasscardModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/components/ClinicRemoteControl.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/components/ClinicRemoteControl.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/components/ClinicSectionFilter.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/components/ClinicSectionFilter.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/components/ClinicTargetSelectModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/components/ClinicTargetSelectModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/components/OperationsSessionTree.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/components/OperationsSessionTree.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/components/PreviousWeekImportModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/components/PreviousWeekImportModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/hooks/index.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/hooks/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/hooks/useClinicParticipants.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/hooks/useClinicParticipants.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/hooks/useClinicStudentSearch.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/hooks/useClinicStudentSearch.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/hooks/useClinicTargets.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/hooks/useClinicTargets.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/pages/BookingsPage/ClinicBookingsPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/pages/BookingsPage/ClinicBookingsPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/pages/HomePage/ClinicHomePage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/pages/HomePage/ClinicHomePage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/pages/MsgSettingsPage/ClinicMsgSettingsPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/pages/MsgSettingsPage/ClinicMsgSettingsPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/pages/OperationsConsolePage/ClinicConsoleSidebar.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/pages/OperationsConsolePage/ClinicConsoleSidebar.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/pages/OperationsConsolePage/ClinicConsoleWorkspace.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/pages/OperationsConsolePage/ClinicConsoleWorkspace.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/pages/OperationsConsolePage/ClinicOperationsConsolePage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/pages/OperationsConsolePage/ClinicOperationsConsolePage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/pages/ReportsPage/ClinicReportsPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/pages/ReportsPage/ClinicReportsPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/pages/SettingsPage/ClinicSettingsPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/pages/SettingsPage/ClinicSettingsPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/utils/buildParticipantPayload.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/utils/buildParticipantPayload.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/clinic/utils/timeSlots.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/clinic/utils/timeSlots.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/community/api/community.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/community/api/community.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/community/components/CmsTreeNav.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/community/components/CmsTreeNav.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/community/components/CommunityAvatar.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/community/components/CommunityAvatar.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/community/components/CommunityContextBar.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/community/components/CommunityContextBar.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/community/components/CommunityEmptyState.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/community/components/CommunityEmptyState.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/community/components/PostReadView.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/community/components/PostReadView.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/community/components/ScopeBadge.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/community/components/ScopeBadge.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/community/context/CommunityScopeContext.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/community/context/CommunityScopeContext.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/community/pages/BoardAdminPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/community/pages/BoardAdminPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/community/pages/CommunityPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/community/pages/CommunityPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/community/pages/CommunitySettingsPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/community/pages/CommunitySettingsPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/community/pages/CounselAdminPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/community/pages/CounselAdminPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/community/pages/MaterialsBoardPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/community/pages/MaterialsBoardPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/community/pages/NoticeAdminPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/community/pages/NoticeAdminPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/community/pages/QnaInboxPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/community/pages/QnaInboxPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/community/utils/communityHelpers.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/community/utils/communityHelpers.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/counseling/pages/CounselPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/counseling/pages/CounselPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/dashboard/components/ClinicRemoconIcon.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/dashboard/components/ClinicRemoconIcon.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/dashboard/components/DashboardShortcutWidget.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/dashboard/components/DashboardShortcutWidget.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/dashboard/components/DashboardWidget.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/dashboard/components/DashboardWidget.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/dashboard/pages/DashboardPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/dashboard/pages/DashboardPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/developer/DeveloperLayout.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/developer/DeveloperLayout.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/developer/pages/DeveloperPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/developer/pages/DeveloperPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/developer/pages/FeatureFlagsPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/developer/pages/FeatureFlagsPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/developer/pages/patchNotesData.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/developer/pages/patchNotesData.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/api/adminExam.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/api/adminExam.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/api/answerKey.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/api/answerKey.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/api/assets.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/api/assets.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/api/examAsset.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/api/examAsset.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/api/examEnrollments.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/api/examEnrollments.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/api/exams.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/api/exams.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/api/explanation.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/api/explanation.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/api/omr.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/api/omr.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/api/question.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/api/question.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/api/questionInit.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/api/questionInit.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/api/regularExam.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/api/regularExam.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/api/sessionEnrollments.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/api/sessionEnrollments.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/api/templateBundles.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/api/templateBundles.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/api/templateEditor.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/api/templateEditor.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/api/templatesWithUsage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/api/templatesWithUsage.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/components/AdminExamDetail.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/components/AdminExamDetail.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/components/AnswerKeyEditor.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/components/AnswerKeyEditor.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/components/AnswerKeyRegisterModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/components/AnswerKeyRegisterModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/components/BlockReason.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/components/BlockReason.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/components/BundleManagementPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/components/BundleManagementPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/components/ExamAssetManager.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/components/ExamAssetManager.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/components/ExamPdfUploadModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/components/ExamPdfUploadModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/components/LectureSessionTree.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/components/LectureSessionTree.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/components/QuestionEditorRow.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/components/QuestionEditorRow.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/components/TemplateEditor.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/components/TemplateEditor.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/components/TemplateManagementPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/components/TemplateManagementPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/components/assets/AssetUploadSection.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/components/assets/AssetUploadSection.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/components/common/ExamHeader.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/components/common/ExamHeader.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/components/common/ExamTabs.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/components/common/ExamTabs.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/components/common/SectionHeader.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/components/common/SectionHeader.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/components/create/ApplyBundleModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/components/create/ApplyBundleModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/components/create/CreateRegularExamModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/components/create/CreateRegularExamModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/components/guards/RequireAssetsReady.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/components/guards/RequireAssetsReady.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/components/submissions/AdminOmrUploadSection.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/components/submissions/AdminOmrUploadSection.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/hooks/useAdminExam.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/hooks/useAdminExam.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/hooks/useExam.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/hooks/useExam.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/hooks/useExamAssets.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/hooks/useExamAssets.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/hooks/useExamEnrollments.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/hooks/useExamEnrollments.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/hooks/usePdfQuestionExtract.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/hooks/usePdfQuestionExtract.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/pages/ExamBundlesPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/pages/ExamBundlesPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/pages/ExamDomainLayout.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/pages/ExamDomainLayout.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/pages/ExamExplorerPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/pages/ExamExplorerPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/pages/ExamTemplatesPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/pages/ExamTemplatesPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/panels/ExamAssetsPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/panels/ExamAssetsPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/panels/ExamResultsPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/panels/ExamResultsPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/panels/ExamResultsViewerPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/panels/ExamResultsViewerPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/panels/ExamSubmissionsPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/panels/ExamSubmissionsPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/panels/setup/ExamBulkActionsPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/panels/setup/ExamBulkActionsPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/panels/setup/ExamEnrollmentPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/panels/setup/ExamEnrollmentPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/panels/setup/ExamPolicyPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/panels/setup/ExamPolicyPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/panels/setup/ExamSetupPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/panels/setup/ExamSetupPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/types.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/types.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/exams/types/ui.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/exams/types/ui.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/fees/api/fees.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/fees/api/fees.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/fees/components/FeesDashboardTab.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/fees/components/FeesDashboardTab.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/fees/components/FeesInvoicesTab.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/fees/components/FeesInvoicesTab.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/fees/components/FeesTemplatesTab.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/fees/components/FeesTemplatesTab.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/fees/pages/FeesPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/fees/pages/FeesPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/guide/pages/AdminGuidePage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/guide/pages/AdminGuidePage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/homework/api/adminHomework.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/homework/api/adminHomework.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/homework/api/homeworkAssignments.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/homework/api/homeworkAssignments.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/homework/api/homeworkPolicy.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/homework/api/homeworkPolicy.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/homework/api/homeworks.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/homework/api/homeworks.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/homework/api/sessionEnrollments.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/homework/api/sessionEnrollments.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/homework/components/AdminHomeworkDetail.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/homework/components/AdminHomeworkDetail.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/homework/components/CreateHomeworkModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/homework/components/CreateHomeworkModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/homework/components/HomeworkEnrollmentManageModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/homework/components/HomeworkEnrollmentManageModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/homework/components/HomeworkPolicyCard.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/homework/components/HomeworkPolicyCard.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/homework/components/common/HomeworkHeader.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/homework/components/common/HomeworkHeader.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/homework/components/common/HomeworkTabs.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/homework/components/common/HomeworkTabs.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/homework/hooks/useAdminHomework.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/homework/hooks/useAdminHomework.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/homework/hooks/useHomeworkAssignments.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/homework/hooks/useHomeworkAssignments.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/homework/hooks/useHomeworkPolicy.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/homework/hooks/useHomeworkPolicy.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/homework/panels/HomeworkAssetsPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/homework/panels/HomeworkAssetsPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/homework/panels/HomeworkResultsPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/homework/panels/HomeworkResultsPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/homework/panels/HomeworkSetupPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/homework/panels/HomeworkSetupPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/homework/panels/HomeworkSubmissionsPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/homework/panels/HomeworkSubmissionsPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/homework/panels/setup/HomeworkEnrollmentPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/homework/panels/setup/HomeworkEnrollmentPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/homework/panels/setup/HomeworkPolicyPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/homework/panels/setup/HomeworkPolicyPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/homework/queryKeys.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/homework/queryKeys.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/homework/types.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/homework/types.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/LectureLayout.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/LectureLayout.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/LecturesLayout.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/LecturesLayout.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/LecturesRoutes.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/LecturesRoutes.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/api/attendance.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/api/attendance.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/api/board.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/api/board.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/api/ddays.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/api/ddays.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/api/enrollments.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/api/enrollments.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/api/materials.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/api/materials.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/api/report.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/api/report.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/api/sections.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/api/sections.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/api/sessions.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/api/sessions.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/api/students.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/api/students.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/components/DdayModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/components/DdayModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/components/EnrollStudentModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/components/EnrollStudentModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/components/LectureCreateModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/components/LectureCreateModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/components/LectureEnrollExcelModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/components/LectureEnrollExcelModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/components/LectureEnrollStudentModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/components/LectureEnrollStudentModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/components/LectureSettingsModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/components/LectureSettingsModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/components/SessionBar.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/components/SessionBar.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/components/SessionCreateModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/components/SessionCreateModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/components/SessionEnrollModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/components/SessionEnrollModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/components/SessionVideosTab.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/components/SessionVideosTab.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/hooks/useLectureParams.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/hooks/useLectureParams.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/hooks/useSessionVideos.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/hooks/useSessionVideos.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/pages/attendance/LectureAttendanceMatrixPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/pages/attendance/LectureAttendanceMatrixPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/pages/attendance/SessionAttendancePage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/pages/attendance/SessionAttendancePage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/pages/ddays/LectureDdayPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/pages/ddays/LectureDdayPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/pages/lectures/LectureStudentsPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/pages/lectures/LectureStudentsPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/pages/lectures/LecturesPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/pages/lectures/LecturesPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/pages/scores/SessionScoresEntryPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/pages/scores/SessionScoresEntryPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/pages/sections/SectionManagementPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/pages/sections/SectionManagementPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/lectures/pages/sessions/LectureSessionsPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/lectures/pages/sessions/LectureSessionsPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/legal/api/legal.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/legal/api/legal.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/legal/index.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/legal/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/legal/pages/PrivacyPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/legal/pages/PrivacyPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/legal/pages/TermsPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/legal/pages/TermsPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/maintenance/pages/MaintenancePage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/maintenance/pages/MaintenancePage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/materials/MaterialsLayout.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/materials/MaterialsLayout.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/materials/MaterialsRoutes.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/materials/MaterialsRoutes.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/materials/api/answerKeys.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/materials/api/answerKeys.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/materials/api/index.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/materials/api/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/materials/api/sheetQuestions.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/materials/api/sheetQuestions.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/materials/api/sheets.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/materials/api/sheets.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/materials/components/TemplateMaterialEditorModal.AssetsTab.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/materials/components/TemplateMaterialEditorModal.AssetsTab.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/materials/components/TemplateMaterialEditorModal.MetaPreviewTab.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/materials/components/TemplateMaterialEditorModal.MetaPreviewTab.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/materials/index.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/materials/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/materials/messages/MessagesPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/materials/messages/MessagesPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/materials/reports/ReportsPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/materials/reports/ReportsPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/materials/sheets/SheetsListPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/materials/sheets/SheetsListPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/materials/sheets/components/SheetsCreateModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/materials/sheets/components/SheetsCreateModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/materials/sheets/components/TemplateMaterialEditorModal.AssetsTab.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/materials/sheets/components/TemplateMaterialEditorModal.AssetsTab.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/materials/sheets/components/TemplateMaterialEditorModal.MetaPreviewTab.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/materials/sheets/components/TemplateMaterialEditorModal.MetaPreviewTab.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/materials/sheets/components/editor/SheetsEditorBody.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/materials/sheets/components/editor/SheetsEditorBody.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/materials/sheets/components/editor/SheetsEditorModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/materials/sheets/components/editor/SheetsEditorModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/materials/sheets/components/submissions/SheetsSubmissionsTab.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/materials/sheets/components/submissions/SheetsSubmissionsTab.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/materials/sheets/components/submissions/SubmissionManualEditModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/materials/sheets/components/submissions/SubmissionManualEditModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/materials/sheets/components/submissions/SubmissionRow.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/materials/sheets/components/submissions/SubmissionRow.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/materials/sheets/components/submissions/submissions.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/materials/sheets/components/submissions/submissions.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/materials/sheets/sheets.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/materials/sheets/sheets.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/MessageLayout.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/MessageLayout.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/MessagesRoutes.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/MessagesRoutes.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/api/messages.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/api/messages.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/api/notificationDispatch.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/api/notificationDispatch.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/components/AlimtalkTemplateInfoPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/components/AlimtalkTemplateInfoPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/components/AutoSendPreviewPopup.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/components/AutoSendPreviewPopup.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/components/AutoSendSectionTree.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/components/AutoSendSectionTree.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/components/AutoSendSettingsPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/components/AutoSendSettingsPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/components/GradesBlockPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/components/GradesBlockPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/components/NotificationPreviewModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/components/NotificationPreviewModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/components/SendMessageModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/components/SendMessageModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/components/TemplateCategoryTree.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/components/TemplateCategoryTree.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/components/TemplateEditModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/components/TemplateEditModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/components/TemplateExplorer.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/components/TemplateExplorer.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/constants/messageSendOptions.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/constants/messageSendOptions.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/constants/templateBlocks.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/constants/templateBlocks.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/context/SendMessageModalContext.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/context/SendMessageModalContext.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/hooks/useAutoSendConfig.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/hooks/useAutoSendConfig.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/hooks/useMessagingInfo.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/hooks/useMessagingInfo.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/hooks/useNotificationLog.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/hooks/useNotificationLog.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/pages/MessageAutoSendPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/pages/MessageAutoSendPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/pages/MessageLogPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/pages/MessageLogPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/pages/MessageSettingsPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/pages/MessageSettingsPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/messages/pages/MessageTemplatesPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/messages/pages/MessageTemplatesPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/notice/context/NoticeContext.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/notice/context/NoticeContext.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/notice/overlays/NoticeOverlay.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/notice/overlays/NoticeOverlay.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/notice/types.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/notice/types.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/ProfileLayout.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/ProfileLayout.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/account/components/ChangePasswordModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/account/components/ChangePasswordModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/account/components/ProfileEditModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/account/components/ProfileEditModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/account/components/ProfileInfoCard.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/account/components/ProfileInfoCard.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/account/components/TenantInfoCard.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/account/components/TenantInfoCard.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/account/pages/ProfileAccountPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/account/pages/ProfileAccountPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/api/profile.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/api/profile.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/attendance/components/AttendanceChartCard.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/attendance/components/AttendanceChartCard.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/attendance/components/AttendanceFormModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/attendance/components/AttendanceFormModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/attendance/components/AttendanceHeader.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/attendance/components/AttendanceHeader.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/attendance/components/AttendanceSummaryCard.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/attendance/components/AttendanceSummaryCard.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/attendance/components/AttendanceTable.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/attendance/components/AttendanceTable.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/attendance/hooks/useAttendanceDomain.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/attendance/hooks/useAttendanceDomain.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/attendance/pages/ProfileAttendancePage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/attendance/pages/ProfileAttendancePage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/excel/attendanceExcel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/excel/attendanceExcel.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/excel/excelUtils.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/excel/excelUtils.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/excel/expenseExcel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/excel/expenseExcel.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/expense/components/ExpenseChartCard.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/expense/components/ExpenseChartCard.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/expense/components/ExpenseFormModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/expense/components/ExpenseFormModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/expense/components/ExpenseHeader.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/expense/components/ExpenseHeader.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/expense/components/ExpenseSummaryCard.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/expense/components/ExpenseSummaryCard.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/expense/components/ExpenseTable.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/expense/components/ExpenseTable.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/expense/hooks/useExpenseAnalytics.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/expense/hooks/useExpenseAnalytics.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/expense/hooks/useExpenseDomain.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/expense/hooks/useExpenseDomain.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/expense/pages/ProfileExpensePage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/expense/pages/ProfileExpensePage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/profile/index.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/profile/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/api/adminExamItemScore.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/api/adminExamItemScore.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/api/adminExamResultDetail.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/api/adminExamResultDetail.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/api/adminSessionExams.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/api/adminSessionExams.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/api/client.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/api/client.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/api/endpoints.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/api/endpoints.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/api/myExamResult.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/api/myExamResult.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/api/wrongNotes.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/api/wrongNotes.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/components/AdminExamResultsTable.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/components/AdminExamResultsTable.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/components/AttemptSelectorPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/components/AttemptSelectorPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/components/EditReasonInput.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/components/EditReasonInput.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/components/FrontResultStatusBadge.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/components/FrontResultStatusBadge.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/components/StudentResultDrawer.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/components/StudentResultDrawer.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/components/WrongNotePanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/components/WrongNotePanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/components/attempt/AttemptMetaPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/components/attempt/AttemptMetaPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/components/attempt/AttemptOMRViewer.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/components/attempt/AttemptOMRViewer.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/components/attempt/AttemptQuestionList.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/components/attempt/AttemptQuestionList.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/components/attempt/AttemptViewerPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/components/attempt/AttemptViewerPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/components/bbox/BBoxLayer.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/components/bbox/BBoxLayer.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/components/bbox/BBoxOverlay.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/components/bbox/BBoxOverlay.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/components/bbox/types.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/components/bbox/types.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/containers/frontResultStatusMaps.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/containers/frontResultStatusMaps.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/hooks/useMyExamResult.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/hooks/useMyExamResult.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/pages/ResultsExplorerPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/pages/ResultsExplorerPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/panels/ExamResultsPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/panels/ExamResultsPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/panels/SessionExamSummaryPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/panels/SessionExamSummaryPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/panels/StudentResultPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/panels/StudentResultPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/types/editState.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/types/editState.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/types/frontResultStatus.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/types/frontResultStatus.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/types/results.types.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/types/results.types.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/utils/deriveFrontResultStatus.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/utils/deriveFrontResultStatus.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/results/utils/deriveFrontResultStatusFromDetail.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/results/utils/deriveFrontResultStatusFromDetail.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/api/attemptHistory.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/api/attemptHistory.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/api/fetchEditableExamItems.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/api/fetchEditableExamItems.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/api/patchExamObjectiveQuick.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/api/patchExamObjectiveQuick.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/api/patchExamSubjectiveQuick.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/api/patchExamSubjectiveQuick.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/api/patchExamTotalQuick.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/api/patchExamTotalQuick.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/api/patchHomeworkQuick.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/api/patchHomeworkQuick.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/api/patchItemScore.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/api/patchItemScore.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/api/pollingSubmission.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/api/pollingSubmission.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/api/queryKeys.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/api/queryKeys.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/api/reorderSession.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/api/reorderSession.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/api/scoreDraft.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/api/scoreDraft.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/api/sessionScores.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/api/sessionScores.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/components/ClinicPrintPreviewModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/components/ClinicPrintPreviewModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/components/ScoreInputCell.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/components/ScoreInputCell.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/components/ScorePrintPreviewModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/components/ScorePrintPreviewModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/components/ScoresTable.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/components/ScoresTable.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/components/StudentScoresDrawer.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/components/StudentScoresDrawer.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/components/SubmissionStatusBadge.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/components/SubmissionStatusBadge.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/hooks/useScoreEditDraft.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/hooks/useScoreEditDraft.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/panels/SessionScoresPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/panels/SessionScoresPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/types.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/types.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/utils/clinicPdfGenerator.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/utils/clinicPdfGenerator.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/utils/examStatus.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/utils/examStatus.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/utils/generateScoreReport.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/utils/generateScoreReport.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/utils/homeworkStatus.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/utils/homeworkStatus.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/utils/scorePdfGenerator.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/utils/scorePdfGenerator.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/scores/utils/sessionScoreRowVerdict.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/scores/utils/sessionScoreRowVerdict.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/sessions/SessionLayout.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/sessions/SessionLayout.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/sessions/api/deleteSessionExam.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/sessions/api/deleteSessionExam.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/sessions/api/deleteSessionHomework.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/sessions/api/deleteSessionHomework.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/sessions/api/sessionScoreSummary.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/sessions/api/sessionScoreSummary.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/sessions/components/AssessmentDeleteBar.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/sessions/components/AssessmentDeleteBar.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/sessions/components/SessionAssessmentSidePanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/sessions/components/SessionAssessmentSidePanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/sessions/components/SessionAssessmentWorkspace.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/sessions/components/SessionAssessmentWorkspace.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/sessions/components/SessionBlock.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/sessions/components/SessionBlock.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/sessions/components/SessionClinicTab.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/sessions/components/SessionClinicTab.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/sessions/components/SessionItemBrowser.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/sessions/components/SessionItemBrowser.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/sessions/components/SessionScoresTab.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/sessions/components/SessionScoresTab.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/sessions/components/enrollment/EnrollmentManageModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/sessions/components/enrollment/EnrollmentManageModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/sessions/components/enrollment/types.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/sessions/components/enrollment/types.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/sessions/components/ops/ExamKanbanCard.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/sessions/components/ops/ExamKanbanCard.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/sessions/components/ops/HomeworkKanbanCard.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/sessions/components/ops/HomeworkKanbanCard.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/sessions/components/ops/KPICard.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/sessions/components/ops/KPICard.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/sessions/components/ops/StatusBadge.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/sessions/components/ops/StatusBadge.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/sessions/hooks/useSessionParams.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/sessions/hooks/useSessionParams.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/sessions/pages/SessionDetailPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/sessions/pages/SessionDetailPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/sessions/utils/examStatus.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/sessions/utils/examStatus.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/settings/SettingsLayout.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/settings/SettingsLayout.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/settings/api/billing.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/settings/api/billing.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/settings/api/theme.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/settings/api/theme.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/settings/api/toss.helper.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/settings/api/toss.helper.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/settings/components/CardManagementSection.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/settings/components/CardManagementSection.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/settings/components/MiniAdminPreview.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/settings/components/MiniAdminPreview.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/settings/components/ThemeCard.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/settings/components/ThemeCard.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/settings/components/ThemeGrid.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/settings/components/ThemeGrid.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/settings/constants/themes.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/settings/constants/themes.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/settings/pages/AppearancePage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/settings/pages/AppearancePage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/settings/pages/BillingSettingsPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/settings/pages/BillingSettingsPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/settings/pages/CardRegisterCallbackPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/settings/pages/CardRegisterCallbackPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/settings/pages/OrganizationSettingsPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/settings/pages/OrganizationSettingsPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/settings/pages/ProfileSettingsPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/settings/pages/ProfileSettingsPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/settings/pages/SettingsPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/settings/pages/SettingsPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/settings/previewThemeVars.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/settings/previewThemeVars.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/settings/theme/themeRuntime.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/settings/theme/themeRuntime.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/StaffLayout.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/StaffLayout.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/StaffRoutes.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/StaffRoutes.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/api/expenses.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/api/expenses.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/api/index.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/api/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/api/payrollSnapshotPdf.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/api/payrollSnapshotPdf.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/api/payrollSnapshots.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/api/payrollSnapshots.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/api/staff.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/api/staff.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/api/staff.detail.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/api/staff.detail.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/api/staffMe.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/api/staffMe.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/api/staffWorkType.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/api/staffWorkType.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/api/workMonthLocks.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/api/workMonthLocks.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/api/workRecords.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/api/workRecords.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/components/ActionButton.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/components/ActionButton.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/components/AttendanceCalendar.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/components/AttendanceCalendar.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/components/HeaderCenterStaffClock.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/components/HeaderCenterStaffClock.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/components/PayrollSummaryCard.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/components/PayrollSummaryCard.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/components/StaffEditModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/components/StaffEditModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/components/StaffPasswordModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/components/StaffPasswordModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/components/StaffWorkspace.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/components/StaffWorkspace.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/components/StaffWorkspaceHeader.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/components/StaffWorkspaceHeader.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/components/StaffWorkspaceTabs.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/components/StaffWorkspaceTabs.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/components/StatusBadge.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/components/StatusBadge.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/components/index.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/components/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/constants/index.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/constants/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/excel/staffExcel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/excel/staffExcel.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/hooks/index.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/hooks/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/hooks/useDeleteStaff.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/hooks/useDeleteStaff.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/hooks/useExpenses.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/hooks/useExpenses.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/hooks/usePayrollSnapshots.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/hooks/usePayrollSnapshots.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/hooks/useStaffDetail.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/hooks/useStaffDetail.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/hooks/useStaffs.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/hooks/useStaffs.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/hooks/useWorkMonthLock.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/hooks/useWorkMonthLock.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/hooks/useWorkRecords.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/hooks/useWorkRecords.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/operations/context/WorkMonthContext.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/operations/context/WorkMonthContext.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffDetailOverlay.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffDetailOverlay.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffExpensesTab.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffExpensesTab.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffPayrollHistoryTab.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffPayrollHistoryTab.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffReportTab.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffReportTab.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffSettingsTab.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffSettingsTab.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffSummaryTab.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffSummaryTab.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffWorkRecordsTab.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffWorkRecordsTab.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffWorkTypeTab.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffWorkTypeTab.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/overlays/StaffDetailOverlay/index.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/overlays/StaffDetailOverlay/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/overlays/index.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/overlays/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/pages/AttendancePage/AttendancePage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/pages/AttendancePage/AttendancePage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/pages/ExpensesPage/ExpensesPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/pages/ExpensesPage/ExpensesPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/pages/HomePage/AddWorkTypeBulkModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/pages/HomePage/AddWorkTypeBulkModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/pages/HomePage/HomePage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/pages/HomePage/HomePage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/pages/HomePage/StaffCreateModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/pages/HomePage/StaffCreateModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/pages/HomePage/StaffHomeTable.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/pages/HomePage/StaffHomeTable.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/pages/HomePage/WorkTypeCreateModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/pages/HomePage/WorkTypeCreateModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/pages/MonthLockPage/MonthLockPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/pages/MonthLockPage/MonthLockPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/pages/OperationsPage/CreateExpenseModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/pages/OperationsPage/CreateExpenseModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/pages/OperationsPage/CreateWorkRecordModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/pages/OperationsPage/CreateWorkRecordModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/pages/OperationsPage/ExpensesPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/pages/OperationsPage/ExpensesPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/pages/OperationsPage/MonthLockPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/pages/OperationsPage/MonthLockPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/pages/OperationsPage/OperationsPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/pages/OperationsPage/OperationsPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/pages/OperationsPage/StaffOperationTable.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/pages/OperationsPage/StaffOperationTable.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/pages/OperationsPage/WorkRecordsPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/pages/OperationsPage/WorkRecordsPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/pages/PayrollSnapshotPage/PayrollSnapshotPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/pages/PayrollSnapshotPage/PayrollSnapshotPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/pages/ReportsPage/PayrollHistoryTable.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/pages/ReportsPage/PayrollHistoryTable.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/pages/ReportsPage/ReportsPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/pages/ReportsPage/ReportsPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/pages/ReportsPage/WorkMonthLockHistory.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/pages/ReportsPage/WorkMonthLockHistory.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/pages/SettingsPage/StaffSettingsPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/pages/SettingsPage/StaffSettingsPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/pages/index.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/pages/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/types/index.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/types/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/staff/utils/index.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/staff/utils/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/storage/StorageLayout.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/storage/StorageLayout.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/storage/StorageRoutes.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/storage/StorageRoutes.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/storage/api/storage.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/storage/api/storage.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/storage/components/Breadcrumb.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/storage/components/Breadcrumb.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/storage/components/FolderTree.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/storage/components/FolderTree.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/storage/components/MoveDuplicateModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/storage/components/MoveDuplicateModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/storage/components/MyStorageExplorer.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/storage/components/MyStorageExplorer.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/storage/components/QuotaIndicator.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/storage/components/QuotaIndicator.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/storage/components/StudentInventoryManage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/storage/components/StudentInventoryManage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/storage/components/StudentStorageExplorer.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/storage/components/StudentStorageExplorer.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/storage/components/UploadModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/storage/components/UploadModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/storage/pages/MyStoragePage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/storage/pages/MyStoragePage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/storage/pages/StudentInventoryPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/storage/pages/StudentInventoryPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/storage/utils/imageCompress.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/storage/utils/imageCompress.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/students/StudentsLayout.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/students/StudentsLayout.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/students/StudentsRoutes.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/students/StudentsRoutes.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/students/api/students.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/students/api/students.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/students/components/DeleteConfirmModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/students/components/DeleteConfirmModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/students/components/EditStudentModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/students/components/EditStudentModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/students/components/PasswordResetModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/students/components/PasswordResetModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/students/components/StudentCreateModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/students/components/StudentCreateModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/students/components/StudentFilterModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/students/components/StudentFilterModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/students/components/StudentsTable.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/students/components/StudentsTable.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/students/components/TagAddModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/students/components/TagAddModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/students/components/TagCreateModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/students/components/TagCreateModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/students/excel/studentExcel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/students/excel/studentExcel.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/students/hooks/useStudentsQuery.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/students/hooks/useStudentsQuery.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/students/inventory/r2InventoryPath.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/students/inventory/r2InventoryPath.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/students/overlays/StudentsDetailOverlay.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/students/overlays/StudentsDetailOverlay.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/students/pages/StudentsHomePage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/students/pages/StudentsHomePage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/students/pages/StudentsRequestsPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/students/pages/StudentsRequestsPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/submissions/api/adminHomeworkSubmissions.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/submissions/api/adminHomeworkSubmissions.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/submissions/api/adminOmrUpload.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/submissions/api/adminOmrUpload.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/submissions/api/adminPendingSubmissions.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/submissions/api/adminPendingSubmissions.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/submissions/api/adminSubmissions.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/submissions/api/adminSubmissions.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/submissions/api/adminSubmissions.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/submissions/api/adminSubmissions.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/submissions/components/AdminOmrBatchUploadBox.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/submissions/components/AdminOmrBatchUploadBox.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/submissions/components/AdminOmrUploadSection.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/submissions/components/AdminOmrUploadSection.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/submissions/components/SubmissionStatusBadge.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/submissions/components/SubmissionStatusBadge.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/submissions/contracts/aiJobContract.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/submissions/contracts/aiJobContract.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/submissions/pages/SubmissionsInboxPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/submissions/pages/SubmissionsInboxPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/submissions/statusMaps.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/submissions/statusMaps.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/submissions/types.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/submissions/types.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/tools/ToolsLayout.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/tools/ToolsLayout.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/tools/ToolsRoutes.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/tools/ToolsRoutes.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/tools/clinic/pages/ClinicPrintoutPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/tools/clinic/pages/ClinicPrintoutPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/tools/clinic/utils/clinicDataParser.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/tools/clinic/utils/clinicDataParser.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/tools/omr/pages/OmrGeneratorPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/tools/omr/pages/OmrGeneratorPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/tools/ppt/api/ppt.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/tools/ppt/api/ppt.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/tools/ppt/components/ImageUploadArea.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/tools/ppt/components/ImageUploadArea.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/tools/ppt/components/PdfUploadArea.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/tools/ppt/components/PdfUploadArea.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/tools/ppt/components/SlideSettingsPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/tools/ppt/components/SlideSettingsPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/tools/ppt/components/SortableImageGrid.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/tools/ppt/components/SortableImageGrid.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/tools/ppt/pages/PptGeneratorPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/tools/ppt/pages/PptGeneratorPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/tools/stopwatch/components/StopwatchCore.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/tools/stopwatch/components/StopwatchCore.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/tools/stopwatch/components/TimerCore.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/tools/stopwatch/components/TimerCore.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/tools/stopwatch/pages/StopwatchPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/tools/stopwatch/pages/StopwatchPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/api/videos.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/api/videos.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/components/VideoExplorerTree.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/components/VideoExplorerTree.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/components/VideoReorderModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/components/VideoReorderModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-analytics/JsonViewerModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-analytics/JsonViewerModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-analytics/VideoAchievementTab.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-analytics/VideoAchievementTab.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-analytics/VideoLogTab.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-analytics/VideoLogTab.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-detail/components/AdminCommentSection.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-detail/components/AdminCommentSection.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-detail/components/AdminHlsPreview.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-detail/components/AdminHlsPreview.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-detail/components/StudentWatchPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-detail/components/StudentWatchPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-detail/components/VideoEngagementBar.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-detail/components/VideoEngagementBar.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-detail/components/VideoPolicySection.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-detail/components/VideoPolicySection.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-detail/components/VideoPreviewSection.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-detail/components/VideoPreviewSection.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-detail/components/VideoProcessingPreview.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-detail/components/VideoProcessingPreview.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-detail/components/VideoStudentsSection.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-detail/components/VideoStudentsSection.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-detail/modals/PermissionModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-detail/modals/PermissionModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-detail/modals/VideoEditModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-detail/modals/VideoEditModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-detail/modals/VideoUploadModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-detail/modals/VideoUploadModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-permission/components/PermissionHeader.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-permission/components/PermissionHeader.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-permission/components/PermissionRow.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-permission/components/PermissionRow.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-permission/components/PermissionSidePanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-permission/components/PermissionSidePanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-permission/components/PermissionTable.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-permission/components/PermissionTable.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-permission/permission.constants.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-permission/permission.constants.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-permission/permission.types.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/components/features/video-permission/permission.types.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/constants/videoProcessing.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/constants/videoProcessing.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/hooks/useVideoPolicy.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/hooks/useVideoPolicy.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/pages/VideoDetail.styles.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/pages/VideoDetail.styles.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/pages/VideoDetailOverlay.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/pages/VideoDetailOverlay.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/pages/VideoDetailPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/pages/VideoDetailPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/pages/VideoExplorerPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/pages/VideoExplorerPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/pages/VideoIdToSessionRedirect.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/pages/VideoIdToSessionRedirect.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/types/access-mode.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/types/access-mode.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/ui/ToggleSwitch.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/ui/ToggleSwitch.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/ui/VideoInfoCards.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/ui/VideoInfoCards.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/ui/VideoStatusBadge.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/ui/VideoStatusBadge.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/ui/VideoThumbnail.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/ui/VideoThumbnail.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/utils/videoStatus.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/utils/videoStatus.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/domains/videos/utils/videoUpload.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/domains/videos/utils/videoUpload.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/layout/AdminLayoutContext.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/layout/AdminLayoutContext.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/layout/AdminNavDrawer.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/layout/AdminNavDrawer.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/layout/AppLayout.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/layout/AppLayout.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/layout/AppLayoutMobile.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/layout/AppLayoutMobile.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/layout/Header.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/layout/Header.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/layout/Sidebar.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/layout/Sidebar.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/layout/TeacherBottomBar.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/layout/TeacherBottomBar.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/layout/TeacherViewContext.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/layout/TeacherViewContext.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_admin/layout/adminNavConfig.d.ts' has not been built from source file 'C:/academy/frontend/src/app_admin/layout/adminNavConfig.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/app/DevAppRouter.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/app/DevAppRouter.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/agent/components/AgentDeskCard.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/agent/components/AgentDeskCard.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/agent/components/AgentDetailPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/agent/components/AgentDetailPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/agent/components/PixelCharacter.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/agent/components/PixelCharacter.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/agent/components/agentUtils.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/agent/components/agentUtils.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/agent/components/zoneConfig.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/agent/components/zoneConfig.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/agent/hooks/useAgentStream.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/agent/hooks/useAgentStream.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/agent/pages/AgentMonitorPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/agent/pages/AgentMonitorPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/agent/types/agent.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/agent/types/agent.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/billing/api/billing.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/billing/api/billing.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/billing/hooks/useBilling.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/billing/hooks/useBilling.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/billing/pages/BillingPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/billing/pages/BillingPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/dashboard/pages/DashboardPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/dashboard/pages/DashboardPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/inbox/api/inbox.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/inbox/api/inbox.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/inbox/hooks/useInbox.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/inbox/hooks/useInbox.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/inbox/pages/InboxPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/inbox/pages/InboxPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/maintenance/api/maintenance.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/maintenance/api/maintenance.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/maintenance/hooks/useMaintenance.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/maintenance/hooks/useMaintenance.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/tenants/api/branding.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/tenants/api/branding.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/tenants/api/tenants.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/tenants/api/tenants.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/tenants/hooks/useBranding.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/tenants/hooks/useBranding.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/tenants/hooks/useTenants.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/tenants/hooks/useTenants.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/tenants/pages/TenantDetailPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/tenants/pages/TenantDetailPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/domains/tenants/pages/TenantsPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/domains/tenants/pages/TenantsPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/layout/DevLayout.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/layout/DevLayout.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_dev/shared/components/DevToast.d.ts' has not been built from source file 'C:/academy/frontend/src/app_dev/shared/components/DevToast.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_promo/app/PromoRouter.d.ts' has not been built from source file 'C:/academy/frontend/src/app_promo/app/PromoRouter.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_promo/domains/landing/components/CtaSection.d.ts' has not been built from source file 'C:/academy/frontend/src/app_promo/domains/landing/components/CtaSection.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_promo/domains/landing/components/LoginModal.d.ts' has not been built from source file 'C:/academy/frontend/src/app_promo/domains/landing/components/LoginModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_promo/domains/landing/pages/AiGradingPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_promo/domains/landing/pages/AiGradingPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_promo/domains/landing/pages/ContactPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_promo/domains/landing/pages/ContactPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_promo/domains/landing/pages/DemoPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_promo/domains/landing/pages/DemoPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_promo/domains/landing/pages/FaqPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_promo/domains/landing/pages/FaqPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_promo/domains/landing/pages/FeaturesPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_promo/domains/landing/pages/FeaturesPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_promo/domains/landing/pages/LandingPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_promo/domains/landing/pages/LandingPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_promo/domains/landing/pages/PricingPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_promo/domains/landing/pages/PricingPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_promo/domains/landing/pages/VideoPlatformPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_promo/domains/landing/pages/VideoPlatformPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_promo/layout/PromoLayout.d.ts' has not been built from source file 'C:/academy/frontend/src/app_promo/layout/PromoLayout.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/app/StudentRouter.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/app/StudentRouter.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/attendance/pages/AttendancePage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/attendance/pages/AttendancePage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/clinic-idcard/api/idcard.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/clinic-idcard/api/idcard.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/clinic-idcard/pages/ClinicIDCardPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/clinic-idcard/pages/ClinicIDCardPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/clinic/api/clinicBooking.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/clinic/api/clinicBooking.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/clinic/pages/ClinicPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/clinic/pages/ClinicPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/community/api/community.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/community/api/community.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/community/pages/CommunityPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/community/pages/CommunityPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/dashboard/api/dashboard.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/dashboard/api/dashboard.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/dashboard/hooks/useStudentDashboard.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/dashboard/hooks/useStudentDashboard.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/dashboard/pages/DashboardPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/dashboard/pages/DashboardPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/exams/api/assets.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/exams/api/assets.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/exams/api/exams.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/exams/api/exams.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/exams/api/results.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/exams/api/results.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/exams/components/ExamCard.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/exams/components/ExamCard.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/exams/hooks/useMyExamResult.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/exams/hooks/useMyExamResult.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/exams/hooks/useMyExamResultItems.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/exams/hooks/useMyExamResultItems.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/exams/hooks/useStudentExams.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/exams/hooks/useStudentExams.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/exams/pages/ExamDetailPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/exams/pages/ExamDetailPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/exams/pages/ExamListPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/exams/pages/ExamListPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/exams/pages/ExamResultPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/exams/pages/ExamResultPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/exams/pages/ExamSubmitPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/exams/pages/ExamSubmitPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/fees/pages/StudentFeesPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/fees/pages/StudentFeesPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/grades/api/grades.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/grades/api/grades.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/grades/components/GradeBadge.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/grades/components/GradeBadge.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/grades/hooks/useMyGradesSummary.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/grades/hooks/useMyGradesSummary.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/grades/pages/GradesPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/grades/pages/GradesPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/guide/pages/GuidePage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/guide/pages/GuidePage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/inventory/api/inventory.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/inventory/api/inventory.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/inventory/pages/MyInventoryPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/inventory/pages/MyInventoryPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/more/pages/MorePage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/more/pages/MorePage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/notices/api/notices.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/notices/api/notices.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/notices/pages/NoticeDetailPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/notices/pages/NoticeDetailPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/notices/pages/NoticesPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/notices/pages/NoticesPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/notifications/api/notifications.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/notifications/api/notifications.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/notifications/hooks/useNotificationCounts.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/notifications/hooks/useNotificationCounts.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/notifications/hooks/useSeenNotifications.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/notifications/hooks/useSeenNotifications.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/notifications/pages/NotificationsPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/notifications/pages/NotificationsPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/profile/api/profile.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/profile/api/profile.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/profile/pages/ProfilePage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/profile/pages/ProfilePage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/sessions/api/sessions.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/sessions/api/sessions.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/sessions/components/SessionAssignmentAction.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/sessions/components/SessionAssignmentAction.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/sessions/components/SessionExamAction.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/sessions/components/SessionExamAction.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/sessions/hooks/useStudentSessions.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/sessions/hooks/useStudentSessions.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/sessions/pages/SessionDetailPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/sessions/pages/SessionDetailPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/sessions/pages/SessionListPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/sessions/pages/SessionListPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/settings/pages/StudentSettingsPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/settings/pages/StudentSettingsPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/submit/pages/SubmitAssignmentPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/submit/pages/SubmitAssignmentPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/submit/pages/SubmitHubPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/submit/pages/SubmitHubPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/submit/pages/SubmitScorePage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/submit/pages/SubmitScorePage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/video/api/video.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/video/api/video.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/video/components/CourseCard.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/video/components/CourseCard.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/video/components/VideoCommentSection.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/video/components/VideoCommentSection.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/video/components/VideoThumbnailWrapper.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/video/components/VideoThumbnailWrapper.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/video/pages/CourseDetailPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/video/pages/CourseDetailPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/video/pages/SessionDetailPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/video/pages/SessionDetailPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/video/pages/VideoHomePage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/video/pages/VideoHomePage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/video/pages/VideoPlayerPage.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/video/pages/VideoPlayerPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/video/playback/player/StudentVideoPlayer.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/video/playback/player/StudentVideoPlayer.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/video/playback/player/design/index.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/video/playback/player/design/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/video/playback/player/design/ui.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/video/playback/player/design/ui.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/video/playback/player/design/utils.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/video/playback/player/design/utils.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/video/playback/player/gesture/SeekOverlay.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/video/playback/player/gesture/SeekOverlay.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/video/playback/player/gesture/useDoubleTapSeek.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/video/playback/player/gesture/useDoubleTapSeek.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/video/playback/player/headless/StudentHlsController.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/video/playback/player/headless/StudentHlsController.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/video/utils/format.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/video/utils/format.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/domains/video/utils/timeAgo.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/domains/video/utils/timeAgo.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/layout/EmptyState.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/layout/EmptyState.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/layout/SectionHeader.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/layout/SectionHeader.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/layout/StudentDrawer.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/layout/StudentDrawer.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/layout/StudentLayout.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/layout/StudentLayout.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/layout/StudentTabBar.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/layout/StudentTabBar.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/layout/StudentTopBar.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/layout/StudentTopBar.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/shared/api/parentStudentSelection.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/shared/api/parentStudentSelection.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/shared/api/student.api.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/shared/api/student.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/shared/context/StudentThemeContext.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/shared/context/StudentThemeContext.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/shared/tenant/studentTenantBranding.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/shared/tenant/studentTenantBranding.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/shared/ui/components/ClinicCalendar.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/shared/ui/components/ClinicCalendar.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/shared/ui/components/NotificationBadge.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/shared/ui/components/NotificationBadge.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/shared/ui/components/ScheduleCalendar.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/shared/ui/components/ScheduleCalendar.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/shared/ui/feedback/studentToast.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/shared/ui/feedback/studentToast.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/shared/ui/icons/Icons.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/shared/ui/icons/Icons.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/shared/ui/pages/StudentPageShell.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/shared/ui/pages/StudentPageShell.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/app_student/shared/utils/date.d.ts' has not been built from source file 'C:/academy/frontend/src/app_student/shared/utils/date.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/auth/api/auth.api.d.ts' has not been built from source file 'C:/academy/frontend/src/auth/api/auth.api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/auth/assets/CommonLogoIcon.d.ts' has not been built from source file 'C:/academy/frontend/src/auth/assets/CommonLogoIcon.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/auth/assets/TchulLogoIcon.d.ts' has not been built from source file 'C:/academy/frontend/src/auth/assets/TchulLogoIcon.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/auth/context/AuthContext.d.ts' has not been built from source file 'C:/academy/frontend/src/auth/context/AuthContext.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/auth/hooks/useAuth.d.ts' has not been built from source file 'C:/academy/frontend/src/auth/hooks/useAuth.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/auth/pages/LoginPage.d.ts' has not been built from source file 'C:/academy/frontend/src/auth/pages/LoginPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/auth/pages/PasswordResetModal.d.ts' has not been built from source file 'C:/academy/frontend/src/auth/pages/PasswordResetModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/auth/pages/SignupModal.d.ts' has not been built from source file 'C:/academy/frontend/src/auth/pages/SignupModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/auth/pages/TenantRequiredPage.d.ts' has not been built from source file 'C:/academy/frontend/src/auth/pages/TenantRequiredPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/core/DevErrorLogger.d.ts' has not been built from source file 'C:/academy/frontend/src/core/DevErrorLogger.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/core/providers/QueryProvider.d.ts' has not been built from source file 'C:/academy/frontend/src/core/providers/QueryProvider.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/core/router/AppRouter.d.ts' has not been built from source file 'C:/academy/frontend/src/core/router/AppRouter.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/core/router/AuthRouter.d.ts' has not been built from source file 'C:/academy/frontend/src/core/router/AuthRouter.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/core/router/ProtectedRoute.d.ts' has not been built from source file 'C:/academy/frontend/src/core/router/ProtectedRoute.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/landing/api/index.d.ts' has not been built from source file 'C:/academy/frontend/src/landing/api/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/landing/editor/LandingEditorPage.d.ts' has not been built from source file 'C:/academy/frontend/src/landing/editor/LandingEditorPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/landing/pages/LandingSamplesPage.d.ts' has not been built from source file 'C:/academy/frontend/src/landing/pages/LandingSamplesPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/landing/pages/PublicLandingPage.d.ts' has not been built from source file 'C:/academy/frontend/src/landing/pages/PublicLandingPage.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/landing/templates/AcademicTrust.d.ts' has not been built from source file 'C:/academy/frontend/src/landing/templates/AcademicTrust.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/landing/templates/MinimalTutor.d.ts' has not been built from source file 'C:/academy/frontend/src/landing/templates/MinimalTutor.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/landing/templates/PremiumDark.d.ts' has not been built from source file 'C:/academy/frontend/src/landing/templates/PremiumDark.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/landing/templates/ProgramPromo.d.ts' has not been built from source file 'C:/academy/frontend/src/landing/templates/ProgramPromo.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/landing/templates/colorUtils.d.ts' has not been built from source file 'C:/academy/frontend/src/landing/templates/colorUtils.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/landing/templates/index.d.ts' has not been built from source file 'C:/academy/frontend/src/landing/templates/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/landing/templates/shared.d.ts' has not been built from source file 'C:/academy/frontend/src/landing/templates/shared.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/landing/types/index.d.ts' has not been built from source file 'C:/academy/frontend/src/landing/types/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/main.d.ts' has not been built from source file 'C:/academy/frontend/src/main.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/api/axios.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/api/axios.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/api/errorMessage.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/api/errorMessage.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/api/jobExport.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/api/jobExport.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/api/retryLogger.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/api/retryLogger.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/constants/api.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/constants/api.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/contexts/ClinicHighlightContext.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/contexts/ClinicHighlightContext.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/contexts/ThemeContext.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/contexts/ThemeContext.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/hooks/useDocumentTitle.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/hooks/useDocumentTitle.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/hooks/useFavicon.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/hooks/useFavicon.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/hooks/useFeesEnabled.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/hooks/useFeesEnabled.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/hooks/useIsMobile.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/hooks/useIsMobile.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/hooks/useSchoolLevelMode.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/hooks/useSchoolLevelMode.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/hooks/useSectionMode.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/hooks/useSectionMode.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/program/index.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/program/index.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/tenant/config.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/tenant/config.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/tenant/index.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/tenant/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/tenant/tenants/dnb.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/tenant/tenants/dnb.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/tenant/tenants/hakwonplus.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/tenant/tenants/hakwonplus.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/tenant/tenants/index.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/tenant/tenants/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/tenant/tenants/limglish.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/tenant/tenants/limglish.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/tenant/tenants/local.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/tenant/tenants/local.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/tenant/tenants/sswe.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/tenant/tenants/sswe.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/tenant/tenants/tchul.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/tenant/tenants/tchul.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/tenant/tenants/types.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/tenant/tenants/types.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/tenant/tenants/ymath.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/tenant/tenants/ymath.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/types/selection.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/types/selection.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/ErrorBoundary.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/ErrorBoundary.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/PhoneInput010Blocks.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/PhoneInput010Blocks.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/SubscriptionExpiredOverlay.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/SubscriptionExpiredOverlay.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/asyncStatus/AsyncStatusBar.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/asyncStatus/AsyncStatusBar.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/asyncStatus/asyncStatusStore.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/asyncStatus/asyncStatusStore.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/asyncStatus/index.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/asyncStatus/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/asyncStatus/useAsyncStatus.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/asyncStatus/useAsyncStatus.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/asyncStatus/useWorkerJobPoller.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/asyncStatus/useWorkerJobPoller.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/asyncStatus/workboxTelemetry.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/asyncStatus/workboxTelemetry.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/avatars/StaffRoleAvatar.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/avatars/StaffRoleAvatar.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/avatars/index.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/avatars/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/badges/AttendanceStatusBadge.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/badges/AttendanceStatusBadge.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/badges/index.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/badges/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/chips/LectureChip.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/chips/LectureChip.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/chips/StudentNameWithLectureChip.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/chips/StudentNameWithLectureChip.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/confirm/ConfirmDialog.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/confirm/ConfirmDialog.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/confirm/ConfirmProvider.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/confirm/ConfirmProvider.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/confirm/index.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/confirm/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/confirm/useConfirm.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/confirm/useConfirm.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/date/DatePicker.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/date/DatePicker.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/date/index.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/date/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/domain/ColorPickerField.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/domain/ColorPickerField.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/domain/DomainLayout.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/domain/DomainLayout.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/domain/DomainListToolbar.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/domain/DomainListToolbar.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/domain/DomainPanel.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/domain/DomainPanel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/domain/DomainTable.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/domain/DomainTable.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/domain/DomainTabs.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/domain/DomainTabs.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/domain/ResizableTh.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/domain/ResizableTh.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/domain/TableColumnPicker.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/domain/TableColumnPicker.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/domain/constants.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/domain/constants.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/domain/index.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/domain/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/domain/tableColumnSpec.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/domain/tableColumnSpec.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/domain/useTableColumnPrefs.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/domain/useTableColumnPrefs.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/ds/Button.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/ds/Button.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/ds/CloseButton.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/ds/CloseButton.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/ds/EmptyState.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/ds/EmptyState.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/ds/KPI.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/ds/KPI.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/ds/Page.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/ds/Page.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/ds/PageHeader.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/ds/PageHeader.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/ds/Panel.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/ds/Panel.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/ds/Section.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/ds/Section.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/ds/SectionHeader.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/ds/SectionHeader.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/ds/Tabs.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/ds/Tabs.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/ds/components/ActionBar.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/ds/components/ActionBar.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/ds/components/ActionButton.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/ds/components/ActionButton.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/ds/components/StatusBadge.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/ds/components/StatusBadge.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/ds/components/StatusToggle.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/ds/components/StatusToggle.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/ds/index.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/ds/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/editor/RichTextEditor.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/editor/RichTextEditor.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/excel/ExcelUploadZone.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/excel/ExcelUploadZone.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/feedback/FeedbackBridge.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/feedback/FeedbackBridge.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/feedback/feedback.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/feedback/feedback.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/feedback/index.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/feedback/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/layout/DomainLayout.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/layout/DomainLayout.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/layout/MetaZone.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/layout/MetaZone.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/layout/VersionChecker.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/layout/VersionChecker.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/layout/WorkboxContext.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/layout/WorkboxContext.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/layout/index.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/layout/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/modal/AdminModal.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/modal/AdminModal.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/modal/ModalBody.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/modal/ModalBody.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/modal/ModalDateSection.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/modal/ModalDateSection.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/modal/ModalFooter.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/modal/ModalFooter.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/modal/ModalHeader.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/modal/ModalHeader.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/modal/ModalOptionRow.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/modal/ModalOptionRow.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/modal/ModalTaskbar.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/modal/ModalTaskbar.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/modal/ModalTimeSection.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/modal/ModalTimeSection.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/modal/ModalWindowContext.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/modal/ModalWindowContext.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/modal/constants.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/modal/constants.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/modal/index.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/modal/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/modal/useDraggableModal.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/modal/useDraggableModal.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/modal/useModalKeyboard.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/modal/useModalKeyboard.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/overlays/InspectOverlayShell.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/overlays/InspectOverlayShell.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/overlays/index.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/overlays/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/session-block/SessionBlockView.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/session-block/SessionBlockView.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/session-block/index.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/session-block/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/session-block/session-block.constants.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/session-block/session-block.constants.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/state/ModalState.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/state/ModalState.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/state/PageState.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/state/PageState.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/state/PanelState.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/state/PanelState.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/state/index.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/state/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/time/TimeRangeInput.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/time/TimeRangeInput.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/time/TimeScrollPopover.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/time/TimeScrollPopover.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/time/index.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/time/index.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/ui/upload/FileUploadZone.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/ui/upload/FileUploadZone.tsx'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/utils/extractApiError.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/utils/extractApiError.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/utils/formatPhone.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/utils/formatPhone.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/utils/lazyWithRetry.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/utils/lazyWithRetry.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/utils/modalValidation.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/utils/modalValidation.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
error TS6305: Output file 'C:/academy/frontend/src/shared/utils/safeDownload.d.ts' has not been built from source file 'C:/academy/frontend/src/shared/utils/safeDownload.ts'.
  The file is in the program because:
    Matched by default include pattern '**/*'
tsconfig.json(3,5): error TS6306: Referenced project 'C:/academy/frontend/tsconfig.app.json' must have setting "composite": true.
tsconfig.json(3,5): error TS6310: Referenced project 'C:/academy/frontend/tsconfig.app.json' may not disable emit.

```

### 1b. Build — `pnpm build`
- **Status:** PASS
- **Time:** 3m 7s (`✓ built in 3m 7s`)
- **Warnings:** 동적+정적 혼합 import 2건; 청크 >600kB (`AdminRouter` ~1.24MB minified / ~357kB gzip)

전체 빌드 로그(에셋 목록·reporter 전문)는 터미널 스냅샷 기준. 핵심 하단:

```
dist/assets/AdminRouter-BMtcHNQm.js                1,237.26 kB │ gzip: 357.26 kB

(!) Some chunks are larger than 600 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 3m 7s
```

### 1c. Django — `python manage.py check --deploy`
```
System check identified some issues:

WARNINGS:
?: (security.W004) You have not set a value for the SECURE_HSTS_SECONDS setting. If your entire site is served only over SSL, you may want to consider setting a value and enabling HTTP Strict Transport Security. Be sure to read the documentation first; enabling HSTS carelessly can cause serious, irreversible problems.
?: (security.W008) Your SECURE_SSL_REDIRECT setting is not set to True. Unless your site should be available over both SSL and non-SSL connections, you may want to either set this setting True or configure a load balancer or reverse-proxy server to redirect all connections to HTTPS.
?: (security.W009) Your SECRET_KEY has less than 50 characters, less than 5 unique characters, or it's prefixed with 'django-insecure-' indicating that it was generated automatically by Django. Please generate a long and random value, otherwise many of Django's security-critical features will be vulnerable to attack.
progress.LectureProgress.enrollment: (fields.W342) Setting unique=True on a ForeignKey has the same effect as using a OneToOneField.
	HINT: ForeignKey(unique=True) is usually better served by a OneToOneField.

System check identified 4 issues (0 silenced).
```

### 1d. Migration drift — `makemigrations --check --dry-run`
```
System check identified some issues:

WARNINGS:
progress.LectureProgress.enrollment: (fields.W342) Setting unique=True on a ForeignKey has the same effect as using a OneToOneField.
	HINT: ForeignKey(unique=True) is usually better served by a OneToOneField.
Migrations for 'billing':
  apps\billing\migrations\0005_alter_billingprofile_provider_customer_key_and_more.py
    ~ Alter field provider_customer_key on billingprofile
    ~ Alter field invoice_number on invoice
    ~ Alter field provider_order_id on paymenttransaction
    ~ Alter field provider_payment_key on paymenttransaction
    ~ Alter field raw_response on paymenttransaction
    ~ Alter field transaction_key on paymenttransaction
```
- **exit_code:** 1 (미적용 마이그레이션 있음)
- **DRIFT app:** `billing`

### 1e. Import walk (`apps` 패키지, `DJANGO_SETTINGS_MODULE=apps.api.config.settings.dev`)
```
IMPORT FAIL: apps.domains.lectures.filters -> cannot import name 'Enrollment' from 'apps.domains.lectures.models' (C:\academy\backend\apps\domains\lectures\models.py)
IMPORT FAIL: apps.domains.results.services.grader -> No module named 'apps.domains.progress.tasks'
IMPORT FAIL: apps.worker.ai_worker.ai.ocr.google -> No module named 'google'
IMPORT FAIL: apps.worker.ai_worker.ai.ocr.tesseract -> No module named 'pytesseract'
IMPORT FAIL: apps.worker.ai_worker.ai.pipelines.dispatcher -> No module named 'google'
```
**Import 실패 건수:** 5

### 1f. Knip — `npx knip --no-exit-code` (first 100 lines, PowerShell)
```
[dotenv@17.3.1] injecting env (5) from .env.e2e -- tip: write to custom object with { processEnv: myObject }
Unused files (117)
functions/[[path]].ts                                                                            
scripts/agent-bridge.mjs                                                                        
scripts/lint-id-safety.cjs                                                                      
e2e/helpers/data.ts                                                                             
e2e/helpers/test-fixtures.ts                                                                    
scripts/assets/crop-icon-padding.mjs                                                            
scripts/assets/crop-tchul-icon.mjs                                                              
scripts/assets/remove-white-background.mjs                                                      
scripts/assets/svg-to-fill-only.mjs                                                             
scripts/assets/trace-tchul-logo.cjs                                                             
scripts/assets/trace-tchul-logo.mjs                                                             
scripts/dev/read-excel.js                                                                       
src/app_student/layout/SectionHeader.tsx                                                        
src/shared/constants/api.ts                                                                     
src/app_admin/domains/exams/exam-explorer-inbox.css                                             
src/app_admin/domains/lectures/LecturesRoutes.tsx                                               
src/app_admin/domains/scores/types.ts                                                           
src/app_admin/domains/settings/previewThemeVars.ts                                              
src/app_admin/domains/students/StudentsRoutes.tsx                                               
src/styles/design-system/patterns/data-table.css                                                
src/styles/design-system/state/status-map.css                                                   
src/styles/design-system/surface/canvas.css                                                     
src/styles/design-system/surface/card.css                                                       
src/styles/design-system/surface/overlay.css                                                    
src/styles/design-system/surface/panel.css                                                      
src/shared/ui/badges/index.ts                                                                   
src/shared/ui/layout/MetaZone.tsx                                                               
src/shared/ui/overlays/index.ts                                                                 
src/shared/ui/overlays/InspectOverlayShell.tsx                                                  
src/shared/ui/state/index.ts                                                                    
src/shared/ui/state/ModalState.tsx                                                              
src/shared/ui/state/PageState.tsx                                                               
src/shared/ui/state/PanelState.tsx                                                              
src/app_admin/domains/clinic/components/OperationsSessionTree.tsx                               
src/app_admin/domains/clinic/hooks/index.ts                                                     
src/app_admin/domains/clinic/hooks/useClinicStudentSearch.ts                                    
src/app_admin/domains/clinic/utils/timeSlots.ts                                                 
src/app_admin/domains/exams/api/regularExam.api.ts                                              
src/app_admin/domains/exams/api/templateEditor.api.ts                                           
src/app_admin/domains/exams/components/AnswerKeyEditor.tsx                                      
src/app_admin/domains/exams/components/ExamAssetManager.tsx                                     
src/app_admin/domains/exams/components/QuestionEditorRow.tsx                                    
src/app_admin/domains/exams/components/TemplateEditor.tsx                                       
src/app_admin/domains/exams/hooks/useExam.ts                                                    
src/app_admin/domains/exams/panels/ExamResultsPanel.tsx                                         
src/app_admin/domains/exams/types/ui.ts                                                         
src/app_admin/domains/homework/api/sessionEnrollments.ts                                        
src/app_admin/domains/lectures/api/board.ts                                                     
src/app_admin/domains/lectures/api/ddays.ts                                                     
src/app_admin/domains/lectures/api/materials.ts                                                 
src/app_admin/domains/lectures/api/report.ts                                                    
src/app_admin/domains/lectures/api/students.ts                                                  
src/app_admin/domains/lectures/components/DdayModal.tsx                                         
src/app_admin/domains/lectures/components/SessionBar.tsx                                        
src/app_admin/domains/materials/api/index.ts                                                    
src/app_admin/domains/materials/components/TemplateMaterialEditorModal.AssetsTab.tsx            
src/app_admin/domains/materials/components/TemplateMaterialEditorModal.MetaPreviewTab.tsx       
src/app_admin/domains/messages/pages/MessageAutoSendPage.module.css                              
src/app_admin/domains/results/api/adminExamItemScore.ts                                         
src/app_admin/domains/results/api/client.ts                                                     
src/app_admin/domains/results/api/endpoints.ts                                                  
src/app_admin/domains/results/api/myExamResult.ts                                               
src/app_admin/domains/results/components/AttemptSelectorPanel.tsx                               
src/app_admin/domains/results/components/EditReasonInput.tsx                                    
src/app_admin/domains/results/hooks/useMyExamResult.ts                                          
src/app_admin/domains/results/utils/deriveFrontResultStatusFromDetail.ts                        
src/app_admin/domains/scores/api/fetchEditableExamItems.ts                                      
src/app_admin/domains/scores/api/pollingSubmission.ts                                           
src/app_admin/domains/results/panels/SessionExamSummaryPanel.tsx                                
src/app_admin/domains/results/panels/StudentResultPanel.tsx                                     
src/app_admin/domains/scores/components/SubmissionStatusBadge.tsx                                 
src/app_admin/domains/scores/utils/examStatus.ts                                                
src/app_admin/domains/sessions/api/sessionScoreSummary.ts                                       
src/app_admin/domains/sessions/components/SessionScoresTab.tsx                                  
src/app_admin/domains/sessions/utils/examStatus.ts                                              
src/app_admin/domains/settings/components/ThemeGrid.tsx                                         
src/app_admin/domains/settings/api/theme.ts                                                     
src/app_admin/domains/settings/pages/SettingsPage.tsx                                           
src/app_admin/domains/staff/api/index.ts                                                        
src/app_admin/domains/staff/components/index.ts                                                 
src/app_admin/domains/staff/constants/index.ts                                                  
src/app_admin/domains/staff/hooks/index.ts                                                      
src/app_admin/domains/staff/hooks/usePayrollSnapshots.ts                                        
src/app_admin/domains/staff/hooks/useStaffDetail.ts                                             
src/app_admin/domains/staff/overlays/index.ts                                                   
src/app_admin/domains/staff/pages/index.ts                                                      
src/app_admin/domains/staff/utils/index.ts                                                      
src/app_admin/domains/staff/types/index.ts                                                      
src/app_admin/domains/students/inventory/r2InventoryPath.ts                                     
src/app_admin/domains/submissions/components/SubmissionStatusBadge.tsx                          
src/app_admin/domains/submissions/api/adminOmrUpload.ts                                         
src/app_admin/domains/videos/ui/VideoInfoCards.tsx                                              
src/app_student/domains/exams/api/assets.ts                                                     
src/app_student/domains/exams/components/ExamCard.tsx                                           
src/app_student/shared/ui/theme/palette.css                                                     
src/app_admin/domains/exams/components/common/SectionHeader.tsx                                 
src/app_admin/domains/exams/components/guards/RequireAssetsReady.tsx                            
src/app_admin/domains/exams/components/submissions/AdminOmrUploadSection.tsx                    
```

**Knip `Unused files` 카운트:** 117

---

## Phase 2: API Contract Consistency
Started: 2026-04-13 (MSG 2 — domains 1–8) | Finished: 동일 세션

### STEP 1 — Command (endpoint inventory)

요청 명령: `cd C:/academy/backend && grep -n "path\|router.register" apps/api/v1/urls.py`  
(Windows 환경에서 워크스페이스 `Grep` 도구로 동일 패턴 매칭 — `apps/api/v1/urls.py` 기준.)

### Endpoint Inventory (v1 최상위 `path` / `include`)

| # | Prefix | App (include target) |
|---|--------|----------------------|
| 1 | `lectures/` | `apps.domains.lectures.urls` |
| 2 | `lectures/` | `apps.domains.attendance.urls` |
| 3 | `students/` | `apps.domains.students.urls` |
| 4 | `enrollments/` | `apps.domains.enrollment.urls` |
| 5 | `fees/` | `apps.domains.fees.urls` |
| 6 | `submissions/` | `apps.domains.submissions.urls` |
| 7 | `exams/` | `apps.domains.exams.urls` |
| 8 | `progress/` | `apps.domains.progress.urls` |
| 9 | `staffs/` | `apps.domains.staffs.urls` |
| 10 | `teachers/` | `apps.domains.teachers.urls` |
| 11 | `results/` | `apps.domains.results.urls` |
| 12 | `homework/` | `apps.domains.homework.urls` |
| 13 | `homeworks/` | `apps.domains.homework_results.urls` |
| 14 | `clinic/` | `apps.domains.clinic.urls` |
| 15 | `assets/` | `apps.domains.assets.urls` |
| 16 | `storage/` | `apps.domains.inventory.urls` |
| 17 | `community/` | `apps.domains.community.api.urls` |
| 18 | `messaging/` | `apps.support.messaging.urls` |
| 19 | `core/` | `apps.core.urls` |
| 20 | `billing/` | `apps.billing.urls` |
| 21 | `media/` | `apps.support.video.urls` |
| 22 | `jobs/` | `apps.domains.ai.urls` |
| 23 | `internal/` | `apps.support.video.urls_internal` |
| 24–33 | `internal/video/...` | 단일 뷰 등 (백로그·DLQ·R2 등) |
| 34 | `tools/` | `apps.domains.tools.urls` |
| 35 | `student/` | `apps.domains.student_app.urls` |

**근거:** ```16:161:c:\academy\backend\apps\api\v1\urls.py```

### STEP 2 — Frontend 타입 탐색 (`shared/api`, `shared/types`)

| 경로 | 결과 |
|------|------|
| `frontend/src/shared/api/` | 도메인 전용 `interface`/`type` 파일 없음 (axios 래퍼만) |
| `frontend/src/shared/types/` | `selection.ts` 등 공통만 — **학생/강의/시험 등 도메인 TS는 `app_admin/domains/*`·`app_student/*`에 위치** |

---

### Domain 1: `students`

**Serializer 클래스 (grep `class \w+Serializer`):** `TagSerializer`, `EnrollmentSerializer`, `StudentListSerializer`, `StudentDetailSerializer`, `AddTagSerializer`, `StudentBulkItemSerializer`, `StudentBulkCreateSerializer`, `StudentCreateSerializer`, `StudentUpdateSerializer`, `RegistrationRequestCreateSerializer`, `RegistrationRequestListSerializer` — 파일 `apps/domains/students/serializers.py` (예: L10–L546).

**백엔드 필드 (핵심):** `StudentListSerializer`·`StudentDetailSerializer`는 `Student` 모델 필드 + `tags`, `enrollments`, `profile_photo_url`, 리스트에 `name_highlight_clinic_target`·`is_enrolled` 등 (`serializers.py` L37–L119). `EnrollmentSerializer`는 `lecture_name`, `lecture_color`, `lecture_chip_label`, `created_at`/`updated_at` 등 (`serializers.py` L17–L33).

**프론트:** `app_admin/domains/students/api/students.api.ts` — `ClientStudent`, `ClientEnrollmentLite`, `mapStudent` (L8–L158).

| Issue | Backend location | Frontend location | Severity |
|-------|------------------|-------------------|----------|
| `Enrollment` 모델에 `enrolled_at` 필드가 있으나 `EnrollmentSerializer`의 `Meta.fields`에 **없음**; API는 `created_at`/`updated_at`만 노출 | `enrollment/models.py` L54; `students/serializers.py` L27–33 | `students.api.ts` L152–153 `enrolledAt: en?.enrolled_at` → **항상 null**에 가까움 | **MEDIUM** |
| 수강 `status` 선택지: 백엔드 `ACTIVE`/`INACTIVE`/`PENDING` vs 프론트 타입 `ACTIVE`\|`DROPPED`\|`COMPLETED` | `enrollment/models.py` L44–50 | `students.api.ts` L20 | **MEDIUM** |
| 나머지 학생 목록 필드는 `mapStudent`가 snake_case→camelCase 매핑으로 대체로 정합 | `serializers.py` L45–55 | `students.api.ts` L98–158 | OK (확인됨) |

---

### Domain 2: `lectures`

**Serializer:** `LectureSerializer`, `SessionSerializer`, `SectionSerializer`, `SectionAssignmentSerializer` — `apps/domains/lectures/serializers.py` (L7–L119). `LectureSerializer`/`SectionSerializer` 등은 `fields = "__all__"` (L10, L31, L87, L104).

**프론트:** 강의 API·타입은 `app_admin/domains/lectures/` 산재 (`api/*.ts`, 페이지별). `src/shared/api`에는 없음.

| Issue | Backend location | Frontend location | Severity |
|-------|------------------|-------------------|----------|
| `lectures.filters`가 잘못된 `Enrollment` import로 **모듈 로드 실패** (Phase 1e) — 필터/쿼리 계약 점검 불가 | `lectures/filters.py` (import) | 필터 사용 뷰/프론트 목록 동작 리스크 | **CRITICAL** |
| `__all__` 직렬화는 모델 추가 시 API 스키마가 변하고 TS가 한 파일에 고정되지 않아 **드리프트 위험** | `lectures/serializers.py` L10, L31, L87 | 도메인별 수동 동기화 필요 | **LOW** |

---

### Domain 3: `exams`

**Serializer:** `apps/domains/exams/serializers/*.py` 다수 (예: `exam.py` `ExamSerializer`, `exam_enrollment_serializer.py` 행 단위 등).

**핵심 `ExamSerializer` 필드:** `exam.py` L29–50 — `session_ids`, `allow_retake`, `max_attempts`, `pass_score`, `open_at`, `close_at`, `answer_visibility` 등.**`template_exam` / `template_exam_id` 미포함.**

**프론트:** `app_admin/domains/exams/types.ts` `Exam`에 `template_exam_id: number \| null` (L41); `api/exams.api.ts` 등에서 `raw.template_exam_id` 매핑.

| Issue | Backend location | Frontend location | Severity |
|-------|------------------|-------------------|----------|
| `ExamSerializer` 명시 `fields`에 **`template_exam_id` 없음** — regular/template 연결 정보가 목록/조회 JSON에 빠질 수 있음 | `exams/serializers/exam.py` L27–50 | `exams/types.ts` L41; `exams.api.ts` 매핑 | **MEDIUM** |
| `ExamEnrollmentRowSerializer` 필드는 `exam_enrollment_serializer.py` L13–24와 일치 | 동일 | `examEnrollments.ts` `ExamEnrollmentRow` L3–15 | OK |

---

### Domain 4: `results`

**Serializer:** `apps/domains/results/serializers/*.py` — 예: `session_scores.py` `SessionScoreRowSerializer`, `exam_result.py` `ExamResultSerializer`, `admin_exam_result_row.py` 등.

**프론트:** `app_admin/domains/results/types/results.types.ts`, `app_admin/domains/scores/api/sessionScores.ts` (`SessionScoreRow`, `ScoreBlock` 등).

| Issue | Backend location | Frontend location | Severity |
|-------|------------------|-------------------|----------|
| `grader` 등이 `apps.domains.progress.tasks` 미존재 모듈 참조 (Phase 1e import 실패) — 비동기 채점 경로 점검 필요 | `results/services/grader.py` | 채점 트리거 UI | **HIGH** |
| `SessionScoreRowSerializer` 필드(`exams`, `homeworks`, `profile_photo_url`, `name_highlight_clinic_target` 등)는 `session_scores.py` L74–93과 프론트 `SessionScoreRow`가 주석·필드명으로 정렬 | `session_scores.py` L74–93 | `sessionScores.ts` L56–80 | OK |

---

### Domain 5: `clinic`

**Serializer:** `ClinicSessionSerializer`, `ClinicSessionParticipantSerializer`, … — `apps/domains/clinic/serializers.py` (L11+).

**프론트:** `app_admin/domains/clinic/api/*.api.ts` (`clinicSessions`, `clinicParticipants`, `clinicStudents` 등).

| Issue | Backend location | Frontend location | Severity |
|-------|------------------|-------------------|----------|
| 세션/참가자 응답 필드 다수(`target_lecture_ids`, `section_label`, `status_summary` 등); 프론트는 API 응답 기반으로 별도 타입 정의 — **필드 추가 시 양쪽 확인 필요** | `clinic/serializers.py` L11–120 | `clinicParticipants.api.ts` 등 | **LOW** |

---

### Domain 6: `homework` (prefix `homework/`)

**Serializer:** `homework/serializers/core.py` (`HomeworkPolicySerializer`, `HomeworkScoreSerializer`, `HomeworkQuickPatchSerializer`), `homework_enrollment_serializer.py`, `homework_assignment_serializer.py`.

**프론트:** `app_admin/domains/homework/types.ts` (`HomeworkPolicy`, `HomeworkScore`, `HomeworkSummary`).

| Issue | Backend location | Frontend location | Severity |
|-------|------------------|-------------------|----------|
| `HomeworkScoreSerializer`는 `HomeworkScore` 모델 기준 필드 명시 (`core.py` L59–79) | `homework/serializers/core.py` | `homework/types.ts` `HomeworkScore` — `homework` FK id vs 프론트에서 `id`만 강조 | OK (스냅샷은 homework_results가 SSOT 주석과 일치) |
| 정책 PATCH 필드는 `HomeworkPolicyPatchSerializer`와 `HomeworkPolicy` 타입이 대응 | `core.py` L41–56 | `types.ts` L54–65 | OK |

---

### Domain 7: `homework_results` (prefix `homeworks/`)

**Serializer:** `homework_results/serializers/homework.py` `HomeworkSerializer`, `homework_score.py` `HomeworkScoreSerializer` 등.

**프론트:** 과제 본체 타입은 `homework` 도메인과 공유; API 경로 `/homeworks/` 기준.

| Issue | Backend location | Frontend location | Severity |
|-------|------------------|-------------------|----------|
| `HomeworkSerializer` 필드 `homework_type`, `template_homework`, `session`, `meta`, `display_order` 등 (`homework.py` L12–23) | `homework_results/serializers/homework.py` | `homework/types.ts` `HomeworkSummary` (`template_homework_id` 네이밍 vs 백엔드 FK `template_homework`) | **LOW** (DRF는 보통 id로 직렬화) |

---

### Domain 8: `attendance` (mounted under `lectures/`)

**Serializer:** `AttendanceSerializer`, `AttendanceMatrixStudentSerializer` — `apps/domains/attendance/serializers.py` (L7–L111).

**프론트:** 출결은 강의/세션 UI·성적과 연동; 공용 타입은 `scores`·`lectures` 쪽.

| Issue | Backend location | Frontend location | Severity |
|-------|------------------|-------------------|----------|
| `AttendanceSerializer` 필드 `enrollment_id`, `student_id`, `lecture_title`, `profile_photo_url`, `name_highlight_clinic_target` 등 (`serializers.py` L37–53) | `attendance/serializers.py` | 출결 테이블/매트릭스 API 소비부 | OK (스코어 행과 동일 SSOT 패턴) |

---

### Domain 9: `community`

**Serializer:** `apps/domains/community/api/serializers.py` — `ScopeNodeMinimalSerializer`, `PostMappingSerializer`, `PostReplySerializer`, `PostAttachmentSerializer`, `PostEntitySerializer`, `BlockTypeSerializer`, `PostTemplateSerializer` 등 (grep `class \w+Serializer`, 예: L5–L185).

**프론트:** `app_admin/domains/community/api/community.api.ts` — `PostEntity`, `ScopeNodeMinimal`, `BlockType`, `PostTemplate` 등.

| Issue | Backend location | Frontend location | Severity |
|-------|------------------|-------------------|----------|
| 커뮤니티 게시/첨부/답변 필드는 `PostEntitySerializer`·`PostReplySerializer`와 TS `PostEntity`·`Answer` 등이 이름·역할 대응 | `community/api/serializers.py` | `community.api.ts` (예: L52–L146) | OK (샘플 대조) |
| `BlockTypeSerializer`에 필드 단위 `validate_code` / `validate_label` 존재 | `serializers.py` L171+ | — | OK |

---

### Domain 10: `fees`

**Serializer:** `apps/domains/fees/serializers.py` — `FeeTemplateSerializer`, `StudentFeeSerializer`, `StudentInvoiceListSerializer`, `StudentInvoiceDetailSerializer`, `FeePaymentSerializer` 등 (L18–L169).

**프론트:** `app_admin/domains/fees/api/fees.api.ts` — `FeeTemplate`, `StudentFee`, `StudentInvoice`, `FeePayment` 등.

| Issue | Backend location | Frontend location | Severity |
|-------|------------------|-------------------|----------|
| 청구/결제 도메인 필드명이 TS 인터페이스와 대체로 snake→camel 매핑 패턴 | `fees/serializers.py` | `fees.api.ts` L12–95 | **LOW** (매퍼·호출부에서 개별 확인 권장) |

---

### Domain 11: `staffs`

**Serializer:** `apps/domains/staffs/serializers.py` — `StaffListSerializer`, `StaffDetailSerializer`, `WorkRecordSerializer`, `ExpenseRecordSerializer`, `PayrollSnapshotSerializer` 등 (L29–L499).

**프론트:** `app_admin/domains/staff/api/*.ts` — `Staff`, `StaffDetail`, `WorkRecord`, `ExpenseRecord`, `PayrollSnapshot` 등.

| Issue | Backend location | Frontend location | Severity |
|-------|------------------|-------------------|----------|
| 급여·근태 필드 다수 — 백엔드 `Meta.fields`와 프론트 타입을 파일 단위로 주기적 동기화 필요 | `staffs/serializers.py` | `staff.api.ts`, `workRecords.api.ts`, … | **LOW** |

---

### Domain 12: `enrollment`

**Serializer:** `apps/domains/enrollment/serializers.py` — `StudentShortSerializer`, `EnrollmentSerializer` (`Meta.fields = "__all__"`, L29–34), `SessionEnrollmentSerializer` (`fields = "__all__"`, L37–47).

**프론트:** 수강 등록은 강의/세션 UI·`students` 매퍼와 교차.

| Issue | Backend location | Frontend location | Severity |
|-------|------------------|-------------------|----------|
| `EnrollmentSerializer`가 `fields = "__all__"` — 모델 필드 추가 시 API 스키마 변동 | `enrollment/serializers.py` L32–34 | 공용 enrollment 소비부 | **LOW** |
| `students` 도메인 `EnrollmentSerializer`와 별도 — 두 직렬화 경로 필드 불일치 주의 | `students/serializers.py` vs `enrollment/serializers.py` | `students.api.ts` | **MEDIUM** (이전 도메인 1과 연계) |

---

### Domain 13: `parents`

**백엔드:** `apps/domains/parents/` — `models.py`, `services/`, `admin.py`, management 커맨드만 존재 (**`serializers.py` / `views.py` / `urls.py` 없음**).

**프론트:** 별도 `parents` API 모듈 없음 — 학부모 비밀번호 등은 서비스/관리 계층.

| Issue | Backend location | Frontend location | Severity |
|-------|------------------|-------------------|----------|
| Phase 2 “serializer ↔ TS” 범위에 해당하는 **공개 REST 엔드포인트 없음** | — | — | N/A |

---

### Domain 14: `progress`

**Serializer:** `apps/domains/progress/serializers.py` — `ProgressPolicySerializer`, `SessionProgressSerializer`, `LectureProgressSerializer`, `ClinicLinkSerializer`, `RiskLogSerializer` (L7–L103).

**프론트:** 클리닉 연동 API `app_admin/domains/clinic/api/clinicLinks.api.ts` — `/progress/clinic-links/` 등.

| Issue | Backend location | Frontend location | Severity |
|-------|------------------|-------------------|----------|
| `ClinicLinkSerializer` 필드(`enrollment_id`, `session_title`, `reason`, `resolution_*` 등)와 클리닉 API 호출이 같은 네임스페이스 사용 | `progress/serializers.py` L64–90 | `clinicLinks.api.ts` | OK |
| `LectureProgress.enrollment` FK `unique=True` 경고는 Phase 1 `check --deploy` `fields.W342`와 동일 계열 | `progress` 모델 / `serializers.py` | — | **LOW** (스키마 이슈) |

---

### Domain 15: `student_app`

**Serializer:** `apps/domains/student_app/**/serializers.py` — 예: `dashboard/serializers.py` `StudentDashboardSerializer`, `exams/serializers.py` `StudentExamSerializer`, `media/serializers.py` 영상 목록/재생, `profile/serializers.py`, `sessions/serializers.py`, `results/serializers.py` 등.

**프론트:** `app_student/domains/**/api/*.ts`, `@student/shared/api/student.api.ts` — `/student/...` 호출.

| Issue | Backend location | Frontend location | Severity |
|-------|------------------|-------------------|----------|
| 학생앱은 `Serializer` 기반 DTO가 다수 — 응답은 주로 dict/list; TS는 `any` 또는 로컬 타입 혼재 | `student_app/**/serializers.py` | `app_student/**/api/*.ts` | **LOW** (엄격 TS 정합은 별도 리팩터) |

---

## Phase 2 (continued) — STEP 2: Permission audit

**명령:** `grep -rn "permission_classes" apps/domains/*/views.py apps/domains/*/views/*.py` 유사 — 워크스페이스에서 `apps/domains/**` 내 `permission_classes` 검색. 다수 파일에서 설정됨 (예: `lectures/views.py`, `fees/views.py`, `enrollment/views.py`, `student_app/**/views.py`, `progress/views.py` 등).

**보조 스크립트 (PowerShell):** `ModelViewSet` \| `ViewSet` \| `APIView` \| `GenericAPIView` 클래스가 있으나 파일 전체에 문자열 `permission_classes`가 **없는** 파일:

```
apps\domains\community\api\views\block_type_views.py
apps\domains\exams\views\answer_key_view.py
apps\domains\exams\views\exam_asset_view.py
apps\domains\exams\views\question_auto_view.py
apps\domains\exams\views\question_view.py
apps\domains\exams\views\sheet_view.py
---COUNT--- 6
```

| File | 상속/패턴 | 판정 |
|------|-----------|------|
| `community/api/views/block_type_views.py` | `BlockTypeViewSet` — **`get_permissions()`** 로 `TenantResolvedAndMember` / `TenantResolvedAndStaff` 분기 (L16–20) | **권한 있음** (DRF 표준) |
| `exams/views/answer_key_view.py` | `AnswerKeyViewSet` — **`get_permissions()`** (L17–20) | **권한 있음** |
| `exams/views/exam_asset_view.py` | `ExamAssetView(APIView)` — **`get_permissions()`** (L31–34) | **권한 있음** |
| `exams/views/question_auto_view.py` | `SheetAutoQuestionsView(APIView)` — **`get_permissions()`** (L29–30) | **권한 있음** |
| `exams/views/question_view.py` | `QuestionViewSet` — **`get_permissions()`** (L18–21) | **권한 있음** |
| `exams/views/sheet_view.py` | `SheetViewSet` — **`get_permissions()`** (L20–25) | **권한 있음** |

**레거시 스캔 보정:** `inventory/views.py`, `tools/ppt/views.py`는 **DRF `ViewSet`/`APIView`가 아니라** Django `View` + `JWTAuthentication`·테넌트·스태프 헬퍼로 인가 — `permission_classes` 미적용이 정상.

---

## Phase 2 — STEP 3: Serializer validation gaps

**명령 유사:** `serializers.py` / `serializers/*.py`에서 `class \w+Serializer`가 있으나 **`def validate` 문자열이 없는** 파일 (필드 단위 `validate_*` 미포함 파일 포함 — 스크립트는 전역 `validate`만 검사).

**결과:** **29**개 파일 (예시):

`attendance/serializers.py`, `enrollment/serializers.py`, `exams/serializers/exam_asset.py`, `exam_enrollment_serializer.py`, `exam_list_student.py`, `question_explanation.py`, `question.py`, `sheet.py`, `template_builder.py`, `template_editor.py`, `template_with_usage.py`, `fees/serializers.py`, `homework_results/serializers/homework.py`, `homework/serializers/homework_assignment_serializer.py`, `homework/serializers/homework_enrollment_serializer.py`, `progress/serializers.py`, `results/serializers/admin_clinic_target.py`, `admin_exam_result_row.py`, `admin_exam_summary.py`, `exam_attempt.py`, `question_stats.py`, `session_exams_summary.py`, `session_score_summary.py`, `session_scores.py`, `student_exam_result.py`, `wrong_note_pdf_serializers.py`, `wrong_note_serializers.py`, `schedule/serializers.py`, `teachers/serializers.py`

**해석:** DTO/`ModelSerializer`/`Serializer`에 **객체 단위 `validate()`가 없음** — 다수는 `Model` 제약·`SerializerMethodField`·뷰 레벨 검증으로 충분. `community/api/serializers.py` 등 일부는 **`validate_code`** 같은 **필드 검증**은 별도 존재.

**참고:** `apps/domains/community/api/serializers.py`는 경로가 `domains/community/api/`라 위 자동 목록에 안 잡힐 수 있음 — 해당 파일에는 `validate_code`/`validate_label` 있음.

---

**15/15 domains checked (Phase 2 serializer ↔ FE 샘플 대조 완료).** Permission·validation 감사는 위에 반영.

---

## Phase 3: Tenant Isolation Audit (MSG 4 — full pass)
Started: 2026-04-13 | Finished: 동일 세션

### STEP 1 — Views: queryset 패턴 스캔

**명령 의도:** `grep -rn "\.objects\.\|\.filter(\|\.get(\|\.all(\|\.exclude(" apps/domains/**/views*.py`  
**실행:** `apps/domains` 아래 경로에 `/views/` 포함 또는 파일명 `views.py`인 `.py` 전부에 대해 정규식  
`\.objects\.|\.filter\(|\.get\(|\.all\(|\.exclude\(` 매칭 개수 집계 (Python).

| Metric | 값 |
|--------|-----|
| **총 매칭 수 (views)** | **1362** |
| **해당 파일 수** | **100** |

→ “줄”이 아니라 **패턴 출현 횟수**이며, 한 줄에 여러 패턴이 있을 수 있음.

**분류 방법 (태스크 규칙 준수):**  
각 매칭마다 전수 읽기는 불가. 대신 **(1)** 대표 `ViewSet`의 `get_queryset` / `perform_*`를 읽어 테넌트 단일 진실 확인, **(2)** `grep "\.objects\.get("` 결과를 **파일 단위로 열어** URL·`request.tenant`·FK 체인 여부 확인, **(3)** 워커·서비스는 별도 STEP.

---

### Summary (스캔·샘플 검증 합성)

| Bucket | Count / 판단 |
|--------|----------------|
| **총 스캔 (views 패턴)** | **1362** |
| **Properly isolated (추정)** | **대다수** — DRF `get_queryset`에서 `tenant` / `lecture__tenant` / `enroll_repo.*_filter_tenant` / `get_object_or_404(..., tenant=...)` 패턴 반복 (예: `lectures/views.py` `LectureViewSet.get_queryset` L41–56). |
| **Suspicious (간접·보완 필요)** | **2건** (아래 표) — PK 조회에 **즉시 tenant 조건 없음**; 후속 필터로만 제한되거나 타입 검사만 함. |
| **Unsafe (확정적 크로스 테넌트 노출)** | **0건** (이번 샘플에서) — 단, **PDF 추출** 경로는 tenant 미검증 `Exam.objects.get` → **수정 권장 (HIGH)**. |
| **By design (격리 위반 아님)** | **1** — Platform Inbox (`IsSuperuserOnly`) 의도적 크로스 테넌트. |

---

### CRITICAL — 테넌트 필터 없음 (확정)

| File:Line | 코드 요약 | 판정 |
|-----------|-----------|------|
| (해당 없음) | 이번 샘플에서 **교차 테넌트로 확정된 데이터 유출** 경로는 없음. 테넌트 관련 **CRITICAL**은 Phase 2 `lectures/filters.py` import 실패(모듈 미로드)로 별도 상정 | **N/A (격리 감사 한계 내)** |

---

### HIGH / SUSPICIOUS — PK·`.objects.get` 등 (파일 열어 확인함)

| File:Line | Code / Model | Why |
|-----------|--------------|-----|
| `exams/views/pdf_question_extract_view.py` L53 | `Exam.objects.get(id=int(exam_id))` | **`tenant` 미포함.** Staff 권한이어도 **다른 테넌트 템플릿 시험 ID**로 타입 검사·후속 R2 키 `tenants/{tenant.id}/...` 혼합 위험. → **`exam`은 `tenant=request.tenant` 또는 `sessions__lecture__tenant`로 한정 권장.** |
| `exams/views/exam_questions_by_exam_view.py` L28 | `Exam.objects.get(id=exam_id)` | 이후 `ExamQuestion` queryset은 `Q(sheet__exam__sessions__lecture__tenant=tenant) \| ...` 로 **강하게 제한** (L33–46). 다만 **`Exam` 단건 조회가 테넌트 무관** → 존재하는 다른 테넌트 `exam_id`로 **템플릿 ID 해석 분기**가 달라질 수 있음 → **`get_object_or_404(Exam, … tenant 경로)`로 통일 권장.** |
| `community/api/views/platform_inbox_views.py` L91, L133 | `PostEntity.objects.get(pk=post_id)` 등 | **`IsSuperuserOnly`** — 플랫폼 수신함 **의도적 전 테넌트**. 일반 테넌트 격리 위반으로 보지 않음. |

**참고 (SAFE로 확인):**  
- `bulk_template_create_view.py` L64–65 `Sheet.objects.get` / `AnswerKey.objects.get` — 직전에 같은 트랜잭션에서 생성한 `exam`/`TemplateBuilderService`가 만든 id만 사용 → **격리 OK.**  
- `homework_results/views/homework_view.py` L78–81 `Homework.objects.get(..., tenant=tenant)` — **명시 tenant.**  
- `results/views/admin_exam_result_detail_view.py` L56–60 — `get_object_or_404(Exam, id=exam_id, sessions__lecture__tenant=request.tenant)` 후 `AnswerKey.objects.get(exam_id=template_id)` — **exam이 이미 테넌트 검증됨** → OK.

---

### Safe patterns (샘플)

| 위치 | Isolation method |
|------|------------------|
| `lectures/views.py` `LectureViewSet` | `enroll_repo.lecture_filter_tenant(tenant)` in `get_queryset` (L41–56) |
| `apps/core/db/tenant_queryset.py` | `TenantQuerySet.for_current_tenant()` — 일부 User 계열 모델 (`core/models/user.py` `TenantQuerySet.as_manager()`) |
| 다수 Admin/API | `get_object_or_404(..., lecture__tenant=request.tenant)` 또는 `Enrollment.objects.filter(..., tenant=request.tenant)` |

---

### STEP 3 — Services layer

**스캔:** `apps/domains/**/services/**/*.py` 및 `services.py` 내 동일 패턴.

| Metric | 값 |
|--------|-----|
| **총 매칭 수 (services)** | **400** |

**해석:** 서비스는 보통 뷰/태스크에서 넘긴 `tenant` 또는 이미 필터된 queryset으로 호출됨. **전수 줄 검증은 미실시** — `results/services/*`, `progress/services/*` 등은 변경 시 **호출부 tenant 전달**을 PR에서 확인하는 것이 안전.

---

### STEP 4 — Workers

**스캔:** `apps/worker/**/*.py` 동일 패턴.

| Metric | 값 |
|--------|-----|
| **총 매칭 수 (worker)** | **289** |

| Worker / 파일 | Receives tenant? | Uses tenant in queries / side effects? |
|---------------|------------------|----------------------------------------|
| **messaging** `messaging_worker/sqs_main.py` | **예** — 메시지 `tenant_id` 필수, 없으면 에러 로그 후 처리 중단 (grep L461 근처: *"Message missing tenant_id"*) | **예** — `get_tenant_messaging_info`, `resolve_kakao_channel`, 잔액 차감 등에 `tenant_id` 전달 |
| **AI** `ai_worker/ai/pipelines/dispatcher.py` | **예** — `payload.get("tenant_id") or job.tenant_id` (L61–63), Redis progress에 `tenant_id` (L38–54) | 작업 처리·진행률 네임스페이스에 반영 |
| **video** 등 | 배치/SQS 페이로드별 상이 — **전수 미완** | R2 키·job payload SSOT는 별도 문서 권장 |

---

### STEP 5 — Custom managers

**명령 의도:** `grep -rn "class.*Manager\|def get_queryset" apps/domains/*/models.py apps/core/models.py`  
**결과:** `domains/**/models.py` 단일 파일에서 `class \w+Manager` / `def get_queryset` **전역 grep 히트 제한적** — 대신 **`apps/core/db/tenant_queryset.py`** 의 `TenantQuerySet`이 **User 계열** 등에 `objects = TenantQuerySet.as_manager()`로 연결됨 (`core/models/user.py`).

**해석:** 도메인 모델 대부분은 **명시 `tenant` FK + 뷰/쿼리셋 필터** 패턴이며, **전역 자동 tenant 매니저는 모든 모델에 적용되지 않음**.

---

### Data Integrity cross-ref

| Check | Result |
|-------|--------|
| Cross-tenant enrollments (DB 스크립트, Phase 5e) | **0** |

---

## Phase 4: Frontend Runtime Testing (Playwright E2E)
Started: 2026-04-13T00:02:20Z | Finished: 2026-04-13T01:43:30Z (**~101분 / 1.7h**, `elapsed_ms` ≈ 6.07e6)  
**Command:** `cd C:/academy/frontend && npx playwright test --reporter=list`  
**Workers:** 1 | **Exit code:** 1  
**원본 로그:** `C:\Users\heon7\.cursor\projects\c-academy\terminals\458329.txt`

### 4a. 사전 헬스 (STEP 1)
- Backend: `GET http://localhost:8000/health` → **200** (참고: `/health/` 는 라우트에 따라 404일 수 있음)
- Frontend: `http://localhost:5174/` → **200** (`pnpm dev` 기준)

### 4c. E2E Suite — 최종 요약 (STEP 3)

| 항목 | 값 |
|------|-----|
| **Passed** | **353** (Playwright: `353 passed (1.7h)`) |
| **Failed** | **112** |
| **Skipped** | **28** |
| **Did not run** | **128** |
| **총 스펙** | 621 |

**한 줄 요약:** **`353 passed, 112 failed, 28 skipped`** — Playwright가 추가로 **`128 did not run`** 을 보고함(실패·중단 등으로 미실행된 스펙).

### 4d. 실패 분류 집계 (STEP 4, 112건)

| Category | 건수 |
|----------|------:|
| ENV ISSUE | 90 |
| SELECTOR / ENV | 6 |
| TIMING / SELECTOR | 6 |
| OUTDATED / SELECTOR | 4 |
| REAL BUG / API CONTRACT | 3 |
| SELECTOR / TIMING | 2 |
| REAL BUG / SELECTOR | 1 |

### 4e. 실패 112건 전수 표 (File · Test name · Category · Error/notes · Needs fix?)

| # | File | Test name | Category | Error / notes | Needs fix? |
|---:|------|-----------|----------|---------------|------------|
| 1 | `admin/04-messaging-audit.spec.ts` | 메시징 전역 감사 — 실사용자 흐름 › 7. 실제 SMS 발송 → 발송 내역 확인 | ENV ISSUE | strict 콘솔: prod CORS·실발송 전제 | 부분 — 스모크 분리 |
| 2 | `admin/05-full-audit.spec.ts` | 메시징 미완 항목 완전 검증 › 1. 성적 발송 — 강의113/차시153 → 성적 탭 → 수업결과 발송 | ENV ISSUE | 하드코드 강의/차시 → 404 | 예 — 데이터/ID |
| 3 | `admin/06-alimtalk-full-verify.spec.ts` | 알림톡 실사용 검증 — 템플릿 편집 → 발송 → 수신 › 2. 템플릿 편집 — 커스텀 양식 생성 + 변수 블록 삽입 | SELECTOR / TIMING | 모달 `toBeVisible` hidden | 재현 후 앱/대기 |
| 4 | `admin/06-alimtalk-full-verify.spec.ts` | 알림톡 실사용 검증 — 템플릿 편집 → 발송 → 수신 › 5. 발송 내역 — 새 발송 기록 확인 (한국어 라벨) | SELECTOR / TIMING | 모달 `toBeVisible` hidden | 재현 후 앱/대기 |
| 5 | `admin/09-send-verify.spec.ts` | 1. 성적 SMS 실제 발송 + 발송 내역 확인 ──────────────── | ENV ISSUE | 실알림톡/SMS·strict 콘솔 | 부분 |
| 6 | `admin/13-all-trigger-send.spec.ts` | 전 트리거 실발송 › 1. 수업결과 발송 (성적 알림톡) — 실제 발송 | ENV ISSUE | 실알림톡/SMS·strict 콘솔 | 부분 |
| 7 | `admin/14-score-alimtalk-send.spec.ts` | 수업결과 발송 알림톡 › 성적탭 > 수업결과 발송 > 알림톡 모드 > 발송 확인 | ENV ISSUE | 실발송·타임아웃/클릭 | 부분 |
| 8 | `admin/15-attendance-score-triggers.spec.ts` | 강의 출결 + 성적 트리거 › 1. 차시 출결 — 출석/결석 트리거 | ENV ISSUE | 실발송·타임아웃/클릭 | 부분 |
| 9 | `admin/15-attendance-score-triggers.spec.ts` | 강의 출결 + 성적 트리거 › 2. 수업결과 발송 알림톡 — 프론트 클릭 | ENV ISSUE | 실발송·타임아웃/클릭 | 부분 |
| 10 | `admin/audit-scores-ux.spec.ts` | Scores/Exam/Homework UX Audit › comprehensive screenshot audit | ENV ISSUE | strict 콘솔·스크린샷 감사 | 조사 |
| 11 | `admin/dnb-clinic-community-msg.spec.ts` | DNB 클리닉/커뮤니티/메시징 검증 › 1. 클리닉 홈 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 12 | `admin/dnb-clinic-community-msg.spec.ts` | DNB 클리닉/커뮤니티/메시징 검증 › 2. 클리닉 운영 콘솔 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 13 | `admin/dnb-clinic-community-msg.spec.ts` | DNB 클리닉/커뮤니티/메시징 검증 › 3. 클리닉 예약 관리 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 14 | `admin/dnb-clinic-community-msg.spec.ts` | DNB 클리닉/커뮤니티/메시징 검증 › 4. 클리닉 리포트 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 15 | `admin/dnb-clinic-community-msg.spec.ts` | DNB 클리닉/커뮤니티/메시징 검증 › 5. 클리닉 설정 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 16 | `admin/dnb-clinic-community-msg.spec.ts` | DNB 클리닉/커뮤니티/메시징 검증 › 6. 클리닉 메시지 설정 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 17 | `admin/dnb-clinic-community-msg.spec.ts` | DNB 클리닉/커뮤니티/메시징 검증 › 7. 도구 > 클리닉 출력 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 18 | `admin/dnb-clinic-community-msg.spec.ts` | DNB 클리닉/커뮤니티/메시징 검증 › 8. 게시판 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 19 | `admin/dnb-clinic-community-msg.spec.ts` | DNB 클리닉/커뮤니티/메시징 검증 › 9. 공지사항 렌더링 + 공지 추가 버튼 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 20 | `admin/dnb-clinic-community-msg.spec.ts` | DNB 클리닉/커뮤니티/메시징 검증 › 10. QnA 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 21 | `admin/dnb-clinic-community-msg.spec.ts` | DNB 클리닉/커뮤니티/메시징 검증 › 11. 상담 (커뮤니티) 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 22 | `admin/dnb-clinic-community-msg.spec.ts` | DNB 클리닉/커뮤니티/메시징 검증 › 12. 자료실 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 23 | `admin/dnb-clinic-community-msg.spec.ts` | DNB 클리닉/커뮤니티/메시징 검증 › 13. 커뮤니티 설정 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 24 | `admin/dnb-clinic-community-msg.spec.ts` | DNB 클리닉/커뮤니티/메시징 검증 › 14. 메시지 템플릿 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 25 | `admin/dnb-clinic-community-msg.spec.ts` | DNB 클리닉/커뮤니티/메시징 검증 › 15. 자동발송 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 26 | `admin/dnb-clinic-community-msg.spec.ts` | DNB 클리닉/커뮤니티/메시징 검증 › 16. 발송내역 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 27 | `admin/dnb-clinic-community-msg.spec.ts` | DNB 클리닉/커뮤니티/메시징 검증 › 17. 메시지 설정 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 28 | `admin/dnb-clinic-community-msg.spec.ts` | DNB 클리닉/커뮤니티/메시징 검증 › 18. 상담 페이지 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 29 | `admin/dnb-core-students.spec.ts` | DNB 코어 + 학생 관리 E2E › 1. 대시보드 렌더링 + 사이드바 메뉴 visible | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 30 | `admin/dnb-core-students.spec.ts` | DNB 코어 + 학생 관리 E2E › 2. 학생 목록 - 사이드바 클릭 이동 + 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 31 | `admin/dnb-core-students.spec.ts` | DNB 코어 + 학생 관리 E2E › 3. 학생 추가 폼 - school_level_mode=elementary_middle 확인 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 32 | `admin/dnb-core-students.spec.ts` | DNB 코어 + 학생 관리 E2E › 4. 학생 상세 - 클릭 → 오버레이 → 탭 확인 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 33 | `admin/dnb-core-students.spec.ts` | DNB 코어 + 학생 관리 E2E › 5. 가입신청 페이지 렌더링 ── | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 34 | `admin/dnb-core-students.spec.ts` | DNB 코어 + 학생 관리 E2E › 6. 설정 > 내 정보 렌더링 ─ | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 35 | `admin/dnb-core-students.spec.ts` | DNB 코어 + 학생 관리 E2E › 7. 설정 > 학원 정보 - DnB 표시 확인 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 36 | `admin/dnb-core-students.spec.ts` | DNB 코어 + 학생 관리 E2E › 8. 설정 > 외관 렌더링 ─── | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 37 | `admin/dnb-core-students.spec.ts` | DNB 코어 + 학생 관리 E2E › 9. 설정 > 랜딩 렌더링 ─── | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 38 | `admin/dnb-core-students.spec.ts` | DNB 코어 + 학생 관리 E2E › 10. 설정 > 결제 렌더링 ── | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 39 | `admin/dnb-core-students.spec.ts` | DNB 코어 + 학생 관리 E2E › 11. 개발자 > 패치노트 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 40 | `admin/dnb-core-students.spec.ts` | DNB 코어 + 학생 관리 E2E › 12. 개발자 > 플래그 - school_level_mode=elementary_middle 확인 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 41 | `admin/dnb-exams-scores.spec.ts` | DNB 시험/성적/과제/도구 E2E 검증 › 1. 시험 탐색기 — /admin/exams 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 42 | `admin/dnb-exams-scores.spec.ts` | DNB 시험/성적/과제/도구 E2E 검증 › 2. 시험 템플릿 — /admin/exams/templates 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 43 | `admin/dnb-exams-scores.spec.ts` | DNB 시험/성적/과제/도구 E2E 검증 › 3. 시험 묶음 — /admin/exams/bundles 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 44 | `admin/dnb-exams-scores.spec.ts` | DNB 시험/성적/과제/도구 E2E 검증 › 4. 성적 탐색기 — /admin/results 렌더링 + 드롭다운 확인 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 45 | `admin/dnb-exams-scores.spec.ts` | DNB 시험/성적/과제/도구 E2E 검증 › 5. 제출함 — /admin/results/submissions 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 46 | `admin/dnb-exams-scores.spec.ts` | DNB 시험/성적/과제/도구 E2E 검증 › 6. 학습지 — /admin/materials/sheets 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 47 | `admin/dnb-exams-scores.spec.ts` | DNB 시험/성적/과제/도구 E2E 검증 › 7. 리포트 — /admin/materials/reports 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 48 | `admin/dnb-exams-scores.spec.ts` | DNB 시험/성적/과제/도구 E2E 검증 › 8. 시험 CRUD — 강의 차시에서 시험 탭 확인 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 49 | `admin/dnb-exams-scores.spec.ts` | DNB 시험/성적/과제/도구 E2E 검증 › 9. 과제 관리 — 차시 상세 과제 탭 확인 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 50 | `admin/dnb-exams-scores.spec.ts` | DNB 시험/성적/과제/도구 E2E 검증 › 10. 도구 > OMR — /admin/tools/omr 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 51 | `admin/dnb-exams-scores.spec.ts` | DNB 시험/성적/과제/도구 E2E 검증 › 11. 도구 > PPT — /admin/tools/ppt 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 52 | `admin/dnb-exams-scores.spec.ts` | DNB 시험/성적/과제/도구 E2E 검증 › 12. 콘솔 에러 수집 — 주요 페이지 순회 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 53 | `admin/dnb-hardcore-verify.spec.ts` | DNB 전체 기능 빡센 실전 검증 › 1. 관리자 로그인 → 대시보드 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 54 | `admin/dnb-lecture-crud.spec.ts` | DNB 강의 CRUD (API) › 1. 강의 생성 (POST) ───── | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 55 | `admin/dnb-lectures-sessions.spec.ts` | DNB Lectures / Sessions / Attendance E2E › 1. Sidebar > Lectures list renders with tabs | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 56 | `admin/dnb-student-app.spec.ts` | DNB 학생앱 전체 E2E › 0. Setup -- 테스트 학생 생성 ── | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 57 | `admin/dnb-uiux-audit.spec.ts` | DNB UI/UX + school_level_mode 실전 검증 › 1. 학생 등록 모달 → 초등/중등만 표시, 고등 없음 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 58 | `admin/dnb-video-staff-storage.spec.ts` | DNB 영상/스태프/저장소/도구/개발자 검증 › 01. 영상 탐색기 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 59 | `admin/dnb-video-staff-storage.spec.ts` | DNB 영상/스태프/저장소/도구/개발자 검증 › 02. 저장소 > 내 저장소 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 60 | `admin/dnb-video-staff-storage.spec.ts` | DNB 영상/스태프/저장소/도구/개발자 검증 › 03. 저장소 > 학생 인벤토리 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 61 | `admin/dnb-video-staff-storage.spec.ts` | DNB 영상/스태프/저장소/도구/개발자 검증 › 04. 스태프 목록 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 62 | `admin/dnb-video-staff-storage.spec.ts` | DNB 영상/스태프/저장소/도구/개발자 검증 › 05. 스태프 출근부 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 63 | `admin/dnb-video-staff-storage.spec.ts` | DNB 영상/스태프/저장소/도구/개발자 검증 › 06. 스태프 경비 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 64 | `admin/dnb-video-staff-storage.spec.ts` | DNB 영상/스태프/저장소/도구/개발자 검증 › 07. 스태프 월 마감 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 65 | `admin/dnb-video-staff-storage.spec.ts` | DNB 영상/스태프/저장소/도구/개발자 검증 › 08. 스태프 급여 스냅샷 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 66 | `admin/dnb-video-staff-storage.spec.ts` | DNB 영상/스태프/저장소/도구/개발자 검증 › 09. 스태프 리포트 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 67 | `admin/dnb-video-staff-storage.spec.ts` | DNB 영상/스태프/저장소/도구/개발자 검증 › 10. 스태프 설정 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 68 | `admin/dnb-video-staff-storage.spec.ts` | DNB 영상/스태프/저장소/도구/개발자 검증 › 11. 스톱워치 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 69 | `admin/dnb-video-staff-storage.spec.ts` | DNB 영상/스태프/저장소/도구/개발자 검증 › 12. 가이드 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 70 | `admin/dnb-video-staff-storage.spec.ts` | DNB 영상/스태프/저장소/도구/개발자 검증 › 13. 버그 리포트 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 71 | `admin/dnb-video-staff-storage.spec.ts` | DNB 영상/스태프/저장소/도구/개발자 검증 › 14. 피드백 렌더링 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 72 | `admin/final-visual-audit.spec.ts` | Final Visual Audit — Scores/Exam/Homework › capture all states systematically | ENV ISSUE | strict 콘솔·스크린샷 감사 | 조사 |
| 73 | `admin/post-deploy-verify.spec.ts` | Post-deploy verification › Test 2: Homework cutline disabled on 2nd row | SELECTOR / ENV | 성적 탭·키보드 힌트·컷라인 | 조사 |
| 74 | `admin/scores-tab-ux.spec.ts` | 성적 탭 UX 개선 검증 › 2. 편집 모드 키보드 힌트 확인 ──────── | SELECTOR / ENV | 성적 탭·키보드 힌트·컷라인 | 조사 |
| 75 | `admin/verify-scores-fixes.spec.ts` | Verify Scores Fixes & UX › 2. Edit mode keyboard hints — Enter and Tab | SELECTOR / ENV | 성적 탭·키보드 힌트·컷라인 | 조사 |
| 76 | `admin/verify-scores-fixes.spec.ts` | Verify Scores Fixes & UX › 7. Exam tab loads | SELECTOR / ENV | 성적 탭·키보드 힌트·컷라인 | 조사 |
| 77 | `admin/verify-scores-fixes.spec.ts` | Verify Scores Fixes & UX › 8. Homework tab loads | SELECTOR / ENV | 성적 탭·키보드 힌트·컷라인 | 조사 |
| 78 | `audit/uiux-admin-assessment.spec.ts` | Admin Assessment Domain - UI/UX Productization › 3. /admin/exams/bundles - Exam Bundles | OUTDATED / SELECTOR | 감사 시나리오와 현 UI 차이 | 조사 |
| 79 | `audit/uiux-admin-clinic-video.spec.ts` | Admin Clinic / Videos / Storage UI/UX Audit | OUTDATED / SELECTOR | 감사 시나리오와 현 UI 차이 | 조사 |
| 80 | `audit/uiux-admin-comms-tools.spec.ts` | Admin Comms & Tools UI/UX › TOOL-2. /admin/tools/omr — OMR 생성기 | OUTDATED / SELECTOR | 감사 시나리오와 현 UI 차이 | 조사 |
| 81 | `audit/uiux-admin-mgmt.spec.ts` | Admin Mgmt UI/UX Audit Part 1 › Staff + Fees + Materials + Settings (1-8) | OUTDATED / SELECTOR | 감사 시나리오와 현 UI 차이 | 조사 |
| 82 | `auth/password-reset-modal.spec.ts` | 비밀번호 찾기 모달 UI 검증 › 존재하지 않는 학생 정보 입력 시 서버 에러 메시지가 표시된다 | REAL BUG / SELECTOR | 서버 에러 문구 미노출 | 예 |
| 83 | `dnb/dnb-click.spec.ts` | DNB 클릭 테스트 › 클리닉 탭 전환: 오늘 → 클리닉 진행 → 진행중 항목 → 패스카드 → 메시지 | ENV ISSUE | `DNB_USER` 미정의 또는 Tenant1≠DnB 브랜딩 | 예 — `.env.e2e`/DnB 전용 스위트 |
| 84 | `flows/data-link-verify.spec.ts` | 데이터 연결 전수 검증 › 2. 학생 QnA → 교사 답변 → 학생 확인 (왕복) | ENV ISSUE | 0317 테스트학생 등 시드 없음 | 예 |
| 85 | `flows/exam-data-flow.spec.ts` | Exam domain data flow › 7. Student: exam detail page shows title and actions | SELECTOR / ENV | 학생 시험 상세 | 조사 |
| 86 | `flows/guide-full-test.spec.ts` | 가이드 기반 전체 테스트 › T03 학생 등록 (단건) ─────────── | ENV ISSUE | 0317 테스트학생 등 시드 없음 | 예 |
| 87 | `flows/real-full-check.spec.ts` | 전체 운영 검증 › 02 교사: 학생 목록에서 0317테스트학생 확인 ─── | ENV ISSUE | 0317 테스트학생 등 시드 없음 | 예 |
| 88 | `flows/real-scenario.spec.ts` | 실제 운영 시나리오 (0317테스트학생) › 10. 학생이 QnA 질문을 등록한다 | ENV ISSUE | 0317 테스트학생 등 시드 없음 | 예 |
| 89 | `shared/01-tenant-branding.spec.ts` | 테넌트 브랜딩 검증 › tchul.com 제목이 박철과학이다 ───── | ENV ISSUE | 외부 도메인 타이틀/격리 — 로컬 불일치 | 예 — 호스트·픽스처 |
| 90 | `shared/01-tenant-branding.spec.ts` | 테넌트 브랜딩 검증 › tchul.com에서 화면 타이틀에 다른 테넌트 브랜드가 보이지 않는다 | ENV ISSUE | 외부 도메인 타이틀/격리 — 로컬 불일치 | 예 — 호스트·픽스처 |
| 91 | `shared/03-tenant-isolation.spec.ts` | 테넌트 격리 검증 › d) 테넌트별 페이지 타이틀이 올바르다 ─── | ENV ISSUE | 외부 도메인 타이틀/격리 — 로컬 불일치 | 예 — 호스트·픽스처 |
| 92 | `shared/04-complaint-prevention.spec.ts` | 불만 방지 시나리오 › 중복 제출 방지: 학생 QnA 제출 후 버튼 비활성화 | TIMING / SELECTOR | QnA·404 플로우 assertion | 조사 |
| 93 | `shared/04-complaint-prevention.spec.ts` | 불만 방지 시나리오 › 삭제된 리소스 접근: 존재하지 않는 게시물 상세 | TIMING / SELECTOR | QnA·404 플로우 assertion | 조사 |
| 94 | `smoke/fees-smoke.spec.ts` | Fees Management › Admin can navigate to fees page and see 3 tabs | ENV ISSUE | 수납 메뉴/플래그 미일치 가능 | 확인 |
| 95 | `smoke/fees-smoke.spec.ts` | Fees Management › Admin can navigate to templates tab and create a fee template | ENV ISSUE | 수납 메뉴/플래그 미일치 가능 | 확인 |
| 96 | `smoke/fees-smoke.spec.ts` | Fees Management › Admin can navigate to invoices tab and see filters | ENV ISSUE | 수납 메뉴/플래그 미일치 가능 | 확인 |
| 97 | `stability/final-edge-verify.spec.ts` | 7. 클리닉 에러 처리 API 레벨 › 학생 클리닉 페이지 정상 로드 (에러 없을 때) | REAL BUG / API CONTRACT | 정상 로드 시 콘솔/에러 기대 불일치 | 조사 |
| 98 | `stability/final-edge-verify.spec.ts` | 7. 클리닉 에러 처리 API 레벨 › 잘못된 API 호출 시 에러 화면 표시 (네트워크 차단) | REAL BUG / API CONTRACT | 차단 시 에러 UI 기대 불일치 | 조사 |
| 99 | `stability/final-edge-verify.spec.ts` | 10. 권한 격리 추가 검증 › 학생 토큰으로 관리자 API 직접 호출 → 403 | REAL BUG / API CONTRACT | 관리자 API 응답 코드 기대(403) 불일치 | 조사 |
| 100 | `verify/clinic-trigger-live.spec.ts` | 클리닉 실전 트리거 — limglish › 1. 클리닉 콘솔 진입 + 오늘 세션 확인 | ENV ISSUE | limglish 실테넌트/세션 전제 불충족 | 예 — 시드·자격 |
| 101 | `verify/clinic-trigger-live.spec.ts` | 클리닉 실전 트리거 — limglish › 2. 출석/결석/완료 버튼 클릭 → 트리거 발동 | ENV ISSUE | limglish 실테넌트/세션 전제 불충족 | 예 — 시드·자격 |
| 102 | `verify/clinic-trigger-live.spec.ts` | 클리닉 실전 트리거 — limglish › 3. 메시지 설정에서 트리거 상태 확인 | ENV ISSUE | limglish 실테넌트/세션 전제 불충족 | 예 — 시드·자격 |
| 103 | `verify/clinic-trigger-live.spec.ts` | 클리닉 실전 트리거 — limglish › 4. 발송 내역에서 클리닉 알림톡 기록 확인 | ENV ISSUE | limglish 실테넌트/세션 전제 불충족 | 예 — 시드·자격 |
| 104 | `verify/student-ux-hard-verify.spec.ts` | 학생앱 UX 강한 검증 › 에러 재시도 — API 차단 시 '다시 시도' 버튼 렌더 | TIMING / SELECTOR | route.abort 후 재시도 UI | 조사 |
| 105 | `verify/student-ux-hard-verify.spec.ts` | 학생앱 UX 강한 검증 › 에러 재시도 — 알림 API 차단 | TIMING / SELECTOR | route.abort 후 재시도 UI | 조사 |
| 106 | `verify/student-ux-hard-verify.spec.ts` | 학생앱 UX 강한 검증 › 에러 재시도 — 공지 상세 API 차단 | TIMING / SELECTOR | route.abort 후 재시도 UI | 조사 |
| 107 | `verify/student-ux-hard-verify.spec.ts` | 학생앱 UX 강한 검증 › 수납 — 에러 시 재시도 + EmptyState 사용 | TIMING / SELECTOR | route.abort 후 재시도 UI | 조사 |
| 108 | `verify/verify-clinic-console.spec.ts` | 클리닉 콘솔 실전 검증 (limglish.kr) › 1. 사이드바 '클리닉' → '클리닉 진행' 탭 → 세션 선택 | ENV ISSUE | `LIMGLISH_USER` 등 미정의(ReferenceError) | 예 — 상수·env 보강 |
| 109 | `verify/verify-modal-messaging.spec.ts` | 메시지 발송 모달 + 템플릿 관리 검증 (limglish.kr) › 시나리오 A: 모달 SMS/알림톡 전환 + 기본 기능 | ENV ISSUE | `LIMGLISH_USER` 등 미정의(ReferenceError) | 예 — 상수·env 보강 |
| 110 | `verify/verify-modal-messaging.spec.ts` | 메시지 발송 모달 + 템플릿 관리 검증 (limglish.kr) › 시나리오 B: 템플릿 관리 (저장/수정/복제/삭제) | ENV ISSUE | `LIMGLISH_USER` 등 미정의(ReferenceError) | 예 — 상수·env 보강 |
| 111 | `verify/verify-modal-messaging.spec.ts` | 메시지 발송 모달 + 템플릿 관리 검증 (limglish.kr) › 잠재 버그 점검: 채널 전환 상태 잔존 + 빈 본문 발송 + 좁은 해상도 | ENV ISSUE | `LIMGLISH_USER` 등 미정의(ReferenceError) | 예 — 상수·env 보강 |
| 112 | `verify/verify-modal-messaging.spec.ts` | 메시지 발송 모달 + 템플릿 관리 검증 (limglish.kr) › 잠재 버그 점검: 모달 닫기 후 재열기 상태 초기화 | ENV ISSUE | `LIMGLISH_USER` 등 미정의(ReferenceError) | 예 — 상수·env 보강 |


### 4f. 해석 메모
- **DnB 스펙 다수:** 로그상 `ReferenceError: DNB_USER is not defined` — `.env.e2e`·상수 미주입 또는 Tenant 1(hakwonplus)에서 DnB 브랜딩 전제 불일치.
- **limglish 검증:** `verify-modal-messaging.spec.ts` 등에서 `LIMGLISH_USER is not defined` — 동일하게 자격 증명·import 보강 필요.
- **실SMS/알림톡·strict 콘솔:** `strictBrowser` 가 프로덕 도메인 CORS·404 콘솔을 실패 처리 — 로컬 단독 스위트와 분리 권장.

### 4g. Route 스캔 / temp spec
- `temp-route-check.spec.ts` 는 **생성·실행하지 않음** (전체 621 스펙 단일 실행).
- **권장:** Tenant 1 코어 스위트와 DnB·실발송·외부도메인 스펙을 CI job 단위로 분리.

---

## Phase 5: Data Integrity
Started: 2026-04-13 (재실행) | Finished: 동일 세션 | **READ-ONLY** (`Enrollment`, `ExamResult` @ `results.models`, `VideoTranscodeJob.state`)

### 5a. Orphan Records

| Check | Count | Severity |
|-------|------:|----------|
| Session without lecture | 0 | PASS |
| Enrollment without student | 0 | PASS |
| Enrollment without lecture | 0 | PASS |
| ExamResult without exam | 0 | PASS |
| Attendance without session | 0 | PASS |

### 5b. Feature Flag Consistency

- **전역 키 (모든 Program 합집합):** `admin_enabled`, `attendance_hourly_rate`, `clinic_mode`, `fee_management`, `school_level_mode`, `section_mode`, `student_app_enabled`
- **일부 키 누락 테넌트 (예시):**

| Tenant | code (예) | Missing keys |
|--------|-----------|--------------|
| 1 | hakwonplus | `clinic_mode`, `school_level_mode`, `section_mode` |
| 2 | tchul | `clinic_mode`, `fee_management`, `school_level_mode`, `section_mode` |
| 3 | limglish | `clinic_mode`, `fee_management`, `school_level_mode`, `section_mode` |
| 4 | ymath | `clinic_mode`, `fee_management`, `school_level_mode`, `section_mode` |
| 8 | sswe | `fee_management`, `school_level_mode` |
| 9 | dnb | `clinic_mode`, `fee_management`, `section_mode` |
| 9999 | 9999 | `fee_management`, `school_level_mode` |

### 5c. Stale Video Jobs

- `VideoTranscodeJob`: 필드는 **`state`** (태스크 예시의 `status`/`PROCESSING` 아님).  
- **`state='RUNNING'`** 이고 `updated_at` 이 **24h 이전**인 건: **0**

### 5d. Null Required Fields

| Model | Field | Null | Empty |
|-------|-------|-----:|------:|
| Student | name | 0 | 0 |
| Lecture | title | 0 | 0 |

### 5e. Duplicates (same phone within tenant)

| Check | Groups | Severity |
|-------|-------:|----------|
| Duplicate phone (tenant + phone 그룹) | **2** | MEDIUM |

샘플: Tenant 3 `01095667308` ×2, Tenant 8 `01027729256` ×2

### 5f. Cross-Tenant (CRITICAL)

| Check | Count | Severity |
|-------|------:|----------|
| `Enrollment` where `student.tenant_id != lecture.tenant_id` | **0** | PASS |

---

## Phase 6: UX Consistency Scan
Started: 2026-04-13 | Finished: 동일 세션 | **코드 리뷰 방식** (태스크의 `temp-ux-scan` 스크린샷 루프는 미실행)

### 6a. 경로 정정

- 태스크 예시 경로 `src/admin/domains/...` 는 **레포에 없음**. 실제 Admin 페이지: **`src/app_admin/domains/*/pages/*.tsx`** — **48개** 파일.
- 아래 표는 **각 페이지 파일 단독**으로 정규식 스캔한 결과이며, **탭·자식 컴포넌트**에만 로딩이 있는 경우 본 파일에는 `-` 로 보일 수 있음 (예: `SessionDetailPage` → 출결/성적 탭 페이지 위임).

### 6a-1. 페이지별 (로딩 / 빈 / 에러 / 개발용 키워드 의심)

표기: **Y** = 해당 패턴 문자열 검출, **-** = 동일 파일 내 미검출. 개발용 열: `tenant_id` 등 **의심** 시 **?**.

| Path (under `app_admin/domains/`) | Loading | Empty | Error | Dev terms |
|-----------------------------------|:-------:|:-----:|:-----:|:---------:|
| `community/pages/BoardAdminPage.tsx` | Y | Y | Y | - |
| `community/pages/CommunityPage.tsx` | - | - | - | - |
| `community/pages/CommunitySettingsPage.tsx` | - | - | - | - |
| `community/pages/CounselAdminPage.tsx` | Y | Y | - | - |
| `community/pages/MaterialsBoardPage.tsx` | Y | Y | Y | - |
| `community/pages/NoticeAdminPage.tsx` | Y | Y | Y | - |
| `community/pages/QnaInboxPage.tsx` | Y | Y | - | - |
| `counseling/pages/CounselPage.tsx` | - | - | - | - |
| `dashboard/pages/DashboardPage.tsx` | Y | - | Y | - |
| `developer/pages/DeveloperPage.tsx` | Y | Y | - | - |
| `developer/pages/FeatureFlagsPage.tsx` | Y | - | - | - |
| `exams/pages/ExamBundlesPage.tsx` | - | - | - | - |
| `exams/pages/ExamDomainLayout.tsx` | - | - | - | - |
| `exams/pages/ExamExplorerPage.tsx` | Y | Y | - | - |
| `exams/pages/ExamTemplatesPage.tsx` | - | - | - | - |
| `fees/pages/FeesPage.tsx` | Y | - | - | - |
| `guide/pages/AdminGuidePage.tsx` | - | - | - | - |
| `legal/pages/PrivacyPage.tsx` | - | - | - | - |
| `legal/pages/TermsPage.tsx` | - | - | - | - |
| `maintenance/pages/MaintenancePage.tsx` | - | - | - | - |
| `messages/pages/MessageAutoSendPage.tsx` | Y | Y | - | - |
| `messages/pages/MessageLogPage.tsx` | Y | Y | Y | - |
| `messages/pages/MessageSettingsPage.tsx` | Y | Y | - | - |
| `messages/pages/MessageTemplatesPage.tsx` | - | - | - | - |
| `profile/account/pages/ProfileAccountPage.tsx` | Y | - | Y | - |
| `profile/attendance/pages/ProfileAttendancePage.tsx` | Y | Y | - | - |
| `profile/expense/pages/ProfileExpensePage.tsx` | Y | Y | - | - |
| `results/pages/ResultsExplorerPage.tsx` | Y | - | - | - |
| `sessions/pages/SessionDetailPage.tsx` | - | Y | Y | - |
| `settings/pages/AppearancePage.tsx` | - | - | - | - |
| `settings/pages/BillingSettingsPage.tsx` | Y | - | Y | ? |
| `settings/pages/CardRegisterCallbackPage.tsx` | Y | - | Y | - |
| `settings/pages/OrganizationSettingsPage.tsx` | Y | Y | - | - |
| `settings/pages/ProfileSettingsPage.tsx` | Y | - | Y | - |
| `settings/pages/SettingsPage.tsx` | - | - | - | - |
| `storage/pages/MyStoragePage.tsx` | - | - | - | - |
| `storage/pages/StudentInventoryPage.tsx` | - | - | - | - |
| `students/pages/StudentsHomePage.tsx` | Y | Y | - | - |
| `students/pages/StudentsRequestsPage.tsx` | Y | Y | - | - |
| `submissions/pages/SubmissionsInboxPage.tsx` | Y | Y | Y | - |
| `tools/clinic/pages/ClinicPrintoutPage.tsx` | - | Y | - | - |
| `tools/omr/pages/OmrGeneratorPage.tsx` | - | - | - | - |
| `tools/ppt/pages/PptGeneratorPage.tsx` | Y | - | - | - |
| `tools/stopwatch/pages/StopwatchPage.tsx` | - | - | - | - |
| `videos/pages/VideoDetailOverlay.tsx` | Y | - | - | - |
| `videos/pages/VideoDetailPage.tsx` | Y | - | - | - |
| `videos/pages/VideoExplorerPage.tsx` | Y | Y | Y | - |
| `videos/pages/VideoIdToSessionRedirect.tsx` | - | - | - | - |

**수동 확인 샘플:** `CommunityPage.tsx` — 라우트 `<Outlet />` 만 두는 껍데기라 본 파일에 로딩/빈 상태 없음. `SessionDetailPage.tsx` — `useQuery` + `sessionError` 등 **에러·빈** 처리 있으나 `Spin` 문구는 하위 탭에 있을 수 있음.

### 6b. Cross-page — 모달 너비 (grep)

- 다수 **`AdminModal`** + **`MODAL_WIDTH`** (`sm` / `md` / `wide` / `form` / `default`) 패턴.
- 일부 **숫자 고정(px)** 혼재: 예) `width={480}`, `520`, `540`, `840`, `920`, `1000` 등 — **메시지/학생/성적/강의** 도메인마다 폭이 달라 일관성 검토 여지 (`src/app_admin` 기준 grep).

### 6c. E2E와 교차 (참고)

| 영역 | Finding | Evidence |
|------|---------|----------|
| 메시징 모달 | 수신자 0일 때 발송 가능성 등 | `08-edge-cases.spec.ts` 로그 |
| SMS↔알림톡 | 채널 전환 시 본문 상태 | 동일 (`[3b] WARN`) |

---

## Phase 7: Edge Case & Validation Audit
Started: 2026-04-13 | Finished: 동일 세션 | 프론트 경로: **`src/app_admin/domains`** (태스크 `src/admin/domains` 대체)

### 7a. Backend serializer 휴리스틱 (grep + 줄 단위 필터)

**명령 의도:** `serializers.(Char|Integer|Float|Decimal)Field` 인데 동일 줄에 `max_length|min_value|max_value|validators` 없음.

- **히트 수:** **150** 줄 (다수 도메인 `serializers*.py`)
- **해석:** 상당수는 **`read_only` / `source=`** 인 출력 필드라 **위험 낮음**. 반면 **쓰기 입력**이 `CharField()` 만 있는 줄(예: `clinic` `location`, `student_app` 일부, `attendance` 목록용 필드)은 **DB/모델 제약·API 검증**과 함께 별도 리뷰 권장.
- **위험도 샘플:** `clinic/serializers.py` `location = serializers.CharField()` — 길이 상한은 모델/마이그레이션 확인 필요.

### 7b. Frontend — `rules=` 없는 폼 후보 (동일 파일 기준)

`Form` / `useForm` + 제출 핸들러 있으나 **`rules=` / `rules:`** 미포함 **5파일:**

| File | 비고 |
|------|------|
| `lectures/pages/sections/SectionManagementPage.tsx` | 수동 `handleSubmit` 가능 |
| `staff/components/StaffEditModal.tsx` | |
| `staff/pages/OperationsPage/CreateWorkRecordModal.tsx` | |
| `students/components/EditStudentModal.tsx` | |
| `students/components/StudentCreateModal.tsx` | |

→ Ant Design 외 검증·필드별 수동 체크 여부는 **파일 내부 확인 필요**.

### 7c. Double-submit — “NO LOADING” 자동 스캔 보정

`onFinish|handleSubmit|onSubmit` 있으나 `loading|isLoading|isPending|useMutation|mutation|busy` **미포함**으로 잡힌 파일 **2개** → **파일 읽기로 재검증:**

| File | 실제 |
|------|------|
| `profile/.../AttendanceFormModal.tsx` | 부모가 **`submitting={domain.submitting}`** 전달 — 이중 제출 방지 **있음** |
| `profile/.../ExpenseFormModal.tsx` | 동일 |

자동 스크립트는 **`submitting` 키워드 미포함** 시 오탐 가능(메모 RULES 준수).

### 7d. Backend duplicate prevention (grep)

- **`UniqueConstraint` / `unique_together` / `unique=True`:** `students`, `lectures`, `enrollment`, `clinic`, `fees`, `staffs`, `attendance`, `inventory`, `ai` 등 **다수 모델**에서 확인.
- **`def create` / `def perform_create`:** `exams`, `students`, `community`, `clinic`, `staffs`, `homework_results`, `submissions` 등 **다수 뷰** — 건별 `IntegrityError` 처리 여부는 **전수 미독**.

### 7e. 도메인 경계 (태스크 목록 — 이번 실행에서 코드 샘플만)

- `results` / `exams` / `students` / `clinic` / `fees` — **점수 상한·음수·전화 형식** 등은 **serializer·모델** 기준 추가 리뷰 권장 (이번 세션에서 파일 전부 미독).

---

## Phase 8: Performance
Started: 2026-04-13 | Finished: 동일 세션 (`pnpm build` 포함)

### 8a. N+1 후보 (휴리스틱)

동일 파일에 `ListModelMixin|ListAPIView|list(` 패턴은 있는데 **`select_related` / `prefetch_related` 문자열 없음** → **10파일:**

- `community/api/views/admin_views.py`, `block_type_views.py`
- `exams/views/exam_view.py`
- `results/views/admin_representative_attempt_view.py`, `admin_result_fact_view.py`, `admin_session_exams_view.py`, `exam_attempt_view.py`, `session_reorder_view.py`
- `submissions/views/exam_omr_batch_upload_view.py`
- `tools/ppt/views.py`

→ **실제 N+1 여부**는 serializer가 관계 접근하는지에 따라 다름 (태스크 RULES: 전부 프리페치 필요는 아님).

### 8b. Pagination (`pagination_class` 문자열 없음)

`class .*ViewSet` 포함 파일 중 **`pagination_class` 문자열 없음** → **31파일** (예: `lectures/views.py`, `students/views/tag_views.py`, `exams/views/*.py` 다수).

→ DRF **전역 `DEFAULT_PAGINATION_CLASS`** 로 커버되는 경우가 많아 **오탐 가능** — 설정(`REST_FRAMEWORK`)과 교차 확인 권장.

### 8c. Frontend 인라인 스타일

- **`src/app_admin/**/*.tsx` 에서 `style={{` 출현 횟수:** **1790** (인라인 객체 → 렌더마다 새 참조 가능성, 휴리스틱만 기록).

### 8d. Large lists

- (변경 없음) 대용량 테이블 **가상 스크롤** 미적용 가능성 — 도메인별 별도 검토.

### 8e. Bundle (`pnpm build` 마지막 요약, 2026-04-13 실행)

- **빌드 시간:** ~**44.93s**
- **대형 청크:** `AdminRouter-*.js` **~1,237 kB** (gzip ~357 kB), `hls-*.js` ~522 kB, `vendor-core` ~491 kB 등 — Vite **>600 kB** 경고와 일치.

---

## Phase 9: Dead Code & Unused Dependencies

### 9a. Knip (Phase 1f와 동일 — 재실행 없음)

- **117** unused files — Knip 출력은 Phase 1f 블록 참고.

### 9b. Backend views vs URLconf (PowerShell·워크스페이스 grep)

태스크의 bash 이중 루프 대신, `APIView`/`ViewSet` 클래스명이 `apps/**/**/*urls*.py` 및 `apps/api/**/*.py` 문자열에 **전혀 등장하지 않는** 후보를 좁혀 확인.

| 클래스 | 파일 | 판정 |
|--------|------|------|
| `AutoGradeSubmissionView` | `domains/results/views/exam_grading_view.py` | **`urls.py`에 미연결** — 동일 이름의 `MyExamResultView`는 `student_exam_result_view.py`가 라우팅됨 |
| `ManualGradeSubmissionView` | 동일 | 미연결 |
| `FinalizeResultView` | 동일 | 미연결 |
| `MyExamResultListView` | 동일 | 미연결 |

`ExamGradingService` 등은 `grading_service`·테스트에서 사용되므로 **HTTP 엔드포인트만 미노출(데드 뷰 후보)** 로 기록.

### 9c–9d. depcheck (`cd frontend && npx depcheck`)

**Unused dependencies:** `@rollup/rollup-linux-x64-gnu`, `@swc/core-linux-x64-gnu`, `lightningcss-linux-x64-gnu`, `xlsx-js-style`  
**Unused devDependencies:** `@jridgewell/gen-mapping`, `autoprefixer`, `imagetracerjs`, `pngjs`, `postcss`, `tailwindcss`  
**Missing (path alias):** `@admin/domains`, `@admin/layout`, `@student/app`, … — Vite/tsconfig 경로 별칭으로 **오탐**.

---

## Phase 10: Security Surface Scan

### 10a. Exposed secrets (`grep` — `SECRET_KEY|PASSWORD|API_KEY|PRIVATE_KEY`, `backend/apps/`, `frontend/src/`)

- **프론트 `src/`:** 위 패턴 **히트 없음** (비밀값 하드코딩 없음).
- **백엔드:** 대부분 `os.getenv` / `getattr(settings, ...)` / 테스트 전용 `test.py` 고정값.
- **검토 대상(상수):** `domains/parents/services/__init__.py:15` — `PARENT_DEFAULT_PASSWORD = "0000"` (학부모 초기 비밀번호 도메인 규칙; 운영 정책·문서와 일치 여부 확인).
- **설정 기본값:** `base.py`·`worker.py` 의 `SECRET_KEY` 기본 문자열은 **개발/워커용** — 프로덕션은 env/SSM 주입 전제 (`prod.py` 주석과 정합).

### 10b. CORS / CSRF / `ALLOWED_HOSTS` (`apps/api/config/settings/`)

| 항목 | 위치 | 메모 |
|------|------|------|
| `ALLOWED_HOSTS = ["*"]` | `dev.py`, `worker.py`, `test.py` | 로컬·워커·테스트 |
| `CORS_ALLOW_ALL_ORIGINS = False`, `CORS_ALLOWED_ORIGINS` / regex | `prod.py`, `base.py` | 프로덕션·기본은 제한적 CORS |
| `CSRF_COOKIE_SECURE`, `CSRF_TRUSTED_ORIGINS` | `prod.py`, `base.py` | HTTPS·신뢰 오리진 |

### 10c. Raw SQL (`cursor.execute` / `.raw(` 등, migration·venv 제외)

| 영역 | 메모 |
|------|------|
| `api/common/views.py`, `worker/video_worker/daemon_main.py` | 헬스 `SELECT 1` |
| `core/views/tenant_info.py` | 테넌트 메타 조회용 SQL |
| `domains/students/views/student_views.py` | 대량 raw SQL 블록(학생·연관 삭제 등) — **테넌트·권한 전제는 뷰 레벨에서 재확인 권장** |
| `management/commands/*` | 운영 커맨드 전용 |

### 10d. XSS (`dangerouslySetInnerHTML`)

| File | Sanitize |
|------|----------|
| `src/app_student/domains/notices/pages/NoticeDetailPage.tsx:87` | `DOMPurify.sanitize(notice.content)` |
| `src/app_student/domains/community/pages/CommunityPage.tsx:1123` | `DOMPurify.sanitize(html)` |
| `src/app_admin/domains/community/components/PostReadView.tsx:53` | `DOMPurify.sanitize(html)` |

**3건 모두 동일 줄에서 `DOMPurify.sanitize` 적용.**

### 10e. Auth bypass (`AllowAny` / `authentication_classes = []`)

| 위치 | 판정 |
|------|------|
| `students/views/password_views.py`, `credential_views.py`, `registration_views.py` | **의도적** — 비로그인 + `TenantResolved` (가입·비밀번호·자격) |
| `core/views/tenant_info.py` — `PublicOgMetaView`, `LegalConfigView` GET | **의도적** — 공개 OG·법적 고지 조회 |
| `core/views/program.py` | **의도적** — 랜딩/구독 메타, `TenantResolved` |
| `support/video/views/internal_views.py` | `authentication_classes = []` 이지만 **`permission_classes = [IsLambdaInternal]`** — Lambda/내부 키 전제, **AllowAny 아님** |

**비인증 노출로 보이는 갭:** 위 grep 범위에서 **신규 플래그 없음** (스로틀은 `api/common/throttles.py` 주석 참고).

### 10f. File upload (`request.FILES` / `FileField` / `ImageField`)

다음 등에서 업로드 처리: `students/views/student_views.py`, `student_app/profile/views.py`, `enrollment/views.py`, `community/api/views/post_views.py`, `submissions/views/*`, `exams/views/pdf_question_extract_view.py`·`exam_asset_view.py`·`exam_image_upload_view.py`, `inventory/views.py`, `tools/ppt/views.py`, `core/views_landing.py`, `core/views/tenant_branding.py` — **도메인별 MIME·크기·권한은 기존 뷰/시리얼라이저와 함께 정기 감사 권장.**

---

## 재현 메모

1. **TypeScript:** `cd C:\academy\frontend && pnpm tsc --noEmit`  
2. **E2E 전체:** `cd C:\academy\frontend && npx playwright test --reporter=list` (621개, 장시간)  
3. **DB 무결성:** `DJANGO_SETTINGS_MODULE=apps.api.config.settings.dev` + `manage.py shell` (Phase 5 스크립트)  
4. **Import walk:** Phase 1e 동일.

---

Generated by Cursor Agent — continuous-testing task (Phases 1–10), 2026-04-13.
