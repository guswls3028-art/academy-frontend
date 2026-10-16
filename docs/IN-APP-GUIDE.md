# 프로그램 내 AtoZ 가이드

현재 사용자 흐름과 화면 계약의 소유 문서입니다. 가이드 내용은 각 역할의
`GuideArticle` 데이터로 관리하며 실제 버튼·라우트·저장 경계가 바뀌면 같은 변경에서
해당 안내도 갱신합니다. 정책·권한은 실제 기능과 백엔드 소유 문서가 결정합니다.

## 대상과 진입

- 관리자: `/workspace/guide`, 18개 업무. 학생 등록 → 강의·차시 → 출결 →
  시험·과제·채점·성적 → 클리닉·영상 → 소통·자료·수납·직원·설정.
- 선생님 모바일: `/workspace/mobile/guide`, 11개 업무. 오늘 수업 → 학생 →
  출결·평가·제출 → 클리닉·소통 → 기능 찾기·도구·업무 마감.
- 학생·학부모: `/student/guide`, 13개 업무. 로그인·자녀 → 수업·영상 →
  시험·파일 제출 → 성적·클리닉·패스카드 → 질문·성적표·자료·납부·계정.
- 각 앱 상단 가이드북의 빠른 안내는 같은 가이드의 `?topic=`으로 연결됩니다.
  전체 가이드는 검색과 주요 기능 목차를 엽니다. 첫 로그인 계정 안내는 별도이며
  완료 상태와 API는 변경하지 않습니다.

## 읽기에서 실제 행동까지

모든 안내는 준비사항, 실제 순서, 완료 확인, 문제별 복구, 다음 업무를 제공합니다.
실제 업무 화면 열기는 정상 앱 라우트로 이동하며 데이터를 만들거나 수정하지 않습니다.
사용자는 기능 화면에서 작업하고 뒤로가기로 읽던 안내에 돌아옵니다.

검색은 제목·본문·준비·완료·문제 해결·키워드를 포함하며 여러 단어는 모두 일치해야
합니다. 분류와 검색은 주소의 `category`·`q`, 읽는 안내는 `topic`에 보존합니다.
새로고침·뒤로가기에서 복구하며 계정·학생 ID나 업무 데이터를 저장하지 않습니다.
현재 필터 밖의 다음 안내를 열면 필터를 해제해 목차와 상세를 일치시킵니다.
검색 직후 빠르게 안내를 선택해도 현재 주소의 검색어·분류를 이어받아 유실하지 않습니다.
검색 결과가 없으면 검색 초기화, 없는/권한 밖 topic은 전체 가이드 복구를 제공합니다.

고정 DOM 선택자에 의존하던 기존 가이드의 투어 시작 버튼은 준비·실행·완료 흐름과
명시적인 화면 열기로 교체했습니다. 조건부로 존재하는 버튼을 못 찾는 투어가
완료를 가장하지 않도록 한 변경입니다. 기존 업무·가이드 라우트는 유지하며,
가이드 자체는 서버 데이터나 저장된 체크리스트를 갖지 않아 데이터 마이그레이션이
없습니다. 공통 투어 API는 다른 소비자를 위해 그대로 유지합니다.

## 권한과 실패 경계

관리자 안내는 실제 관리자 메뉴의 `useAvailableAdminNavigation`으로 필터링합니다.
수납·직원 관리처럼 현재 계정에 없는 메뉴의 실행 링크를 추가 노출하지 않습니다.
학생 수납 안내는 실제 수납 feature flag와 같은 hook을 사용합니다.
학부모는 기존 자녀 선택 게이트·API 범위를 그대로 사용하고, 학생과 자녀의 제출·예약·
조회 권한을 임의로 새로 정의하지 않습니다. 개인 정보·계정 변경 경계도 그대로입니다.

가이드 조회는 정적 데이터로 추가 API 요청을 만들지 않습니다. 역할별 기존 인증·
프로그램·권한 조회는 기존 소유 컴포넌트를 사용합니다. 로딩·저장·부분 실패·
최종 확인은 해당 기능의 실제 화면이 소유하며 안내는 성공/실패를 대신 판정하지 않습니다.
자동 저장과 최종 저장, 명부와 수강·차시 배정, 파일 전송과 처리 완료,
제출과 평가, 예약 신청과 확정, 참석과 학습 통과를 구분합니다.
알림톡은 승인 공용 채널·템플릿을 따르고 SMS/LMS 대체를 안내하지 않습니다.

## 내용 대조 근거

| 안내 | 현재 구현 근거 |
|---|---|
| 학생 계정·엑셀 | `app_admin/domains/students/components/StudentCreateModal.tsx` |
| 강의·차시 | `app_admin/domains/lectures/components/{LectureCreateModal,SessionCreateModal,SessionEnrollModal}.tsx` |
| 시험 탐색·생성 | `app_admin/domains/exams/pages/ExamExplorerPage.tsx`, 차시 시험·성적 화면 |
| 과제 생성·배정 | `app_admin/domains/homework/components/CreateHomeworkModal.tsx` |
| 성적 저장·서술형 | `app_admin/domains/lectures/pages/scores/SessionScoresEntryPage.tsx` |
| 클리닉 | `app_admin/domains/clinic/ClinicLayout.tsx`, 학생 `ClinicPage.tsx`·`ClinicIDCardPage.tsx` |
| 파일별 제출·부분 실패 | `app_student/domains/submit/pages/SubmitAssignmentPage.tsx` |
| 시험 답안·마감·재응시 | `app_student/domains/exams/pages/{ExamDetailPage,ExamSubmitPage}.tsx` |
| 외부 성적표 | `app_student/domains/submit/pages/SubmitScorePage.tsx` |
| 학부모 범위 | `app_student/layout/{StudentLayout,ParentChildSwitcher}.tsx` |
| 모바일 출결·점수·PC 연결 | 교사 `SwipeAttendancePage.tsx`, `MobileScoreEntryPage.tsx`, `SessionDetailPage.tsx`, `DesktopOnlyPage.tsx` |
| 수납·자료·도구·설정 | 해당 도메인의 현재 Layout·탭·등록/저장 컴포넌트 |

경로는 모두 `src/` 아래입니다. 자세한 도메인 정책은
[관리자 사용 안내](USER-GUIDE-ADMIN.md),
[학생 사용 안내](USER-GUIDE-STUDENT.md),
[학생·학부모 계정](https://github.com/guswls3028-art/academy-backend/blob/main/docs/domain/parent-account.md),
[메시징 정책](https://github.com/guswls3028-art/academy-backend/blob/main/docs/ssot/messaging-policy.md)을 따릅니다.

## 접근성·반응형·검증

역할별 원문은 `shared/ui/guide/content/`에서 관리하며 기존 앱의 데이터 경로는
re-export로 유지합니다. [홍보 페이지 전체 가이드](PROMO-GUIDE-AND-SUPPORT.md)는
동일한 원문과 `GuideCatalog`의 `public` 모드를 사용합니다. 기본 `app` 모드의
업무 화면 실행 링크·권한·저장 흐름은 유지합니다.

공통 `shared/ui/guide/GuideCatalog.tsx`는 라벨 있는 검색, 실제 button/link,
분류 aria-pressed, 목차 aria-current, 안내 전환 시 제목 포커스, 네이티브 details
문제 해결을 제공합니다. 760px 이하에서는 한 열로 전환하고 선택한 안내를 목차보다
먼저 보여 깊은 링크에서도 긴 목차를 지나지 않게 합니다. 목차로 돌아가기는 검색·분류를
유지하고 목차에 포커스를 돌립니다. 제어는 최소 44px,
본문은 긴 한글을 줄바꿈합니다. 역할 테마를 사용하고 reduced-motion에서는
전환 애니메이션을 제거합니다.
앱의 링크·목록 초기화 스타일보다 가이드의 대비색과 순서 번호를 우선 적용합니다.
실제 렌더링된 실행 링크의 대비 4.5:1, 단계 번호, 준비 목록 기호와 각 단계·완료·
복구 영역까지의 스크롤을 검사하고 상단·완료·복구를 나누어 캡처합니다.

`e2e/auth/first-login-guide.mock.spec.ts`는 기존 계정 안내 완료·재로그인 동작과
가이드 검색→본문·복구→새로고침→다음 안내→뒤로가기, 없는 안내·빈 검색 복구,
권한 밖 메뉴 차단, 관리자/학생/교사 390·1366px 및 관리자 1100px의
`assertInteractiveSurface`를 검증합니다. 각 역할 화면을 증거로 첨부합니다.
`e2e/flows/guide-rendering.spec.ts`는 실제 로그인 후 읽기 전용 가이드 흐름을
확인하며 요소가 없으면 건너뛰는 조건부 성공을 사용하지 않습니다.
가이드 검증은 제품 업무의 실제 저장·발송·생성 성공을 대신하는 증거가 아닙니다.
배포와 동일 산출물 검증은 기존 정식 release gates를 따릅니다.
배포 후 기존 production canary의 로그인 세션에서 관리자·교사·학생 가이드의
1366/390px 본문과 실행 링크 → 실제 업무 경로 → 뒤로가기 → 새로고침을
읽기 전용으로 확인하고 가이드 본문만 캡처합니다. 가이드 검증은 업무 데이터를
생성·수정하지 않으며 기존 로그인·조회 관측 기록과 구분합니다.
