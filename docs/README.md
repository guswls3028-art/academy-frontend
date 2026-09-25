# frontend/docs — 프론트엔드 문서

## 문서 목록

| 문서 | 내용 |
|------|------|
| [ROUTING.md](ROUTING.md) | 공개 URL 네이밍, 권한 분리, 기존 경로 호환 규칙 |
| [API-CONTRACTS.md](API-CONTRACTS.md) | 백엔드 OpenAPI 고정 SHA와 생성 TypeScript 타입 드리프트 계약 |
| [VIDEO-DIRECT-ACCESS.md](VIDEO-DIRECT-ACCESS.md) | 수강 등록 없이 영상 1개만 여는 관리자 승인·회수와 학생 무쓰기 재생 계약 |
| [PUBLIC-VIDEO-WORKFLOW.md](PUBLIC-VIDEO-WORKFLOW.md) | 공개 영상의 첫 추가, 명시적 공간 준비, 실패·재시도와 구버전 호환 |
| [REFACTOR-GUARDRAILS.md](REFACTOR-GUARDRAILS.md) | 도메인 공개 표면, 대형 파일, 생성 코드 분리와 CI 부채 예산 |
| [BROWSER-PERSISTENCE.md](BROWSER-PERSISTENCE.md) | 인증·표시 취향·사용자 초안·운영 선호의 브라우저 저장 범위와 실패 안전 계약 |
| [DATA-LIST-CONTRACT.md](DATA-LIST-CONTRACT.md) | 테이블·성적 그리드·선택 모달의 정렬, 필터, 동률, 페이지·390px 계약 |
| [USER-GUIDE-ADMIN.md](USER-GUIDE-ADMIN.md) | 관리자 앱 사용 가이드 |
| [USER-GUIDE-STUDENT.md](USER-GUIDE-STUDENT.md) | 학생 앱 사용 가이드 |
| [STUDENT-PARENT-APP-CONTRACT.md](STUDENT-PARENT-APP-CONTRACT.md) | 학생·학부모 앱의 표시 경계, 모바일 레이아웃, 권한·자녀 선택·알림 읽음 계약 |
| [STUDENT-GRADE-REPORT.md](STUDENT-GRADE-REPORT.md) | 학원별 성장 그래프 섹션 표시·순서 편집과 학생 시험 카드의 오답 완료/미완료 표시 계약 |
| [GRADING-WRONG-NOTE-WORKFLOW.md](GRADING-WRONG-NOTE-WORKFLOW.md) | Codex 빠른 복구 순서, 시험명 작업 메뉴, 정오표 입력·반응형 계약, 증상별 확인 위치와 현재 오답노트 경계 |
| [ASSESSMENT-OPERATIONS-WORKSPACE.md](ASSESSMENT-OPERATIONS-WORKSPACE.md) | 시험·과제 운영 준비 점검선, 충돌·초안 복구가 있는 통합 정책 편집, 공용 대상자 변경 요약과 반응형 계약 |
| [OMR-GENERATOR.md](OMR-GENERATOR.md) | 관리자 OMR 답안지 설정, 정적 미리보기, PDF 다운로드와 반응형 A4 표시 계약 |
| [OMR-BATCH-PROGRESS.md](OMR-BATCH-PROGRESS.md) | OMR 1~100장 단일 접수, 서버 정본 진행 복구, 실패 ordinal 재선택과 완료 알림 계약 |
| [HOMEWORK-SCORING.md](HOMEWORK-SCORING.md) | 과제별 만점·합격 기준, 성적표 분모·저장 계약 |
| [ATTENDANCE-ROSTER-SAFETY.md](ATTENDANCE-ROSTER-SAFETY.md) | 차시 수강생 일괄배정의 미입력 시작, 선택 검토·실행취소, 전체 현장 출석의 원자적 되돌리기 계약 |
| [ARRIVAL-OPERATIONS.md](ARRIVAL-OPERATIONS.md) | 보강 예정 입력과 클리닉 예약을 합친 대시보드·우상단 알림 운영 계약 |
| [관리자](../src/app_admin/domains/clinic/README.md) · [선생님](../src/app_teacher/domains/clinic/README.md) · [학생](../src/app_student/domains/clinic/README.md) 클리닉 | 세션별 같은 날 다중 시간대 예약 정책과 역할별 생성·신청·추가 UX 계약 |
| [LECTURE-SESSION-SCOPES.md](LECTURE-SESSION-SCOPES.md) | 강의 안의 정규 수업·보강 분리 진입, 보강 이름 생성·수정 계약 |
| [STUDENT-LECTURE-MEMOS.md](STUDENT-LECTURE-MEMOS.md) | 학생 공통 메모와 학생별 강의 메모의 차시 공유·편집·동시 수정·직원 화면 계약 |
| [REAL-USE-REVIEW-MANUAL.md](REAL-USE-REVIEW-MANUAL.md) | 실제 운영 흐름과 UI/UX 상품성을 함께 점검하는 반복 검수 매뉴얼 |
| [REAL-USE-E2E-INVENTORY.md](REAL-USE-E2E-INVENTORY.md) | 기존 E2E 자산을 실사용 운영 리뷰 관점으로 분류한 인벤토리 |
| [DEPLOYMENT-OPERATIONS.md](DEPLOYMENT-OPERATIONS.md) | Cloudflare preview/production/rollback, scoped token, PR 무쓰기 E2E, Actions 공급망, backend/frontend release-bundle readback 계약 |
| [DEV-INBOX-GUIDE.md](DEV-INBOX-GUIDE.md) | 학원 직원 문의 제출·답변 확인과 플랫폼 문의 처리 가이드 |
| [DEVELOPER-CONSOLE.md](DEVELOPER-CONSOLE.md) | 개발자 콘솔 정보 구조, 운영 상태 레저, 반응형 메뉴, 조회 실패·쓰기 안전 계약 |
| [TENANT-BRANDING.md](TENANT-BRANDING.md) | 신규 테넌트 로그인·역할별 공용 헤더 브랜딩 계약과 검증표 |
| [DEV-TENANT-OPERATIONS.md](DEV-TENANT-OPERATIONS.md) | 개발자 콘솔 테넌트·소유자 생성, 기존 계정 승격, 실패 안전 UI 계약 |
| [TCHUL-PUBLIC-SITE.md](TCHUL-PUBLIC-SITE.md) | tchul 공식 홈페이지의 정보 구조, 매치업 PDF 게시·공유, 반응형·실패 처리 계약 |
| [PRODUCT-USAGE-ANALYTICS.md](PRODUCT-USAGE-ANALYTICS.md) | 역할별 화면·CTA·대표 업무 사용 신호와 실패 안전 계약 |
| [TEACHER-TOOLS.md](TEACHER-TOOLS.md) | 강사 도구함 확장 규칙과 AI 풀이·해설 Beta 상호작용 계약 |
| [PROBLEM-REVIEW-REPORT.md](PROBLEM-REVIEW-REPORT.md) | 시험지 업로드부터 검수 편집, PDF/PPTX 다운로드까지 문제 리뷰 리포트 화면 계약 |
| [FIRST-LOGIN-GUIDE.md](FIRST-LOGIN-GUIDE.md) | 신규 계정의 공통 1회 계정 안내 UX와 역할별 이동 경로 |
| [SUBSCRIPTION-LOGIN-NOTICE.md](SUBSCRIPTION-LOGIN-NOTICE.md) | 실제 직원 로그인당 1회 이용료 납부 안내와 서버 정책·권한 경계 |
| [STAFF-CLOCK-IN.md](STAFF-CLOCK-IN.md) | 조교 로그인 출근유형 선택, 비근무 로그인, PC·모바일 출퇴근과 정본 기간 기록 계약 |
| [ACCOUNT-CREDENTIAL-FLOWS.md](ACCOUNT-CREDENTIAL-FLOWS.md) | 역할별 본인 비밀번호 변경, 직원 강제 초기화, 공용 계정복구의 화면→API·세션 폐기 계약 |
| [PRODUCT-UPDATES.md](PRODUCT-UPDATES.md) | 공개 업데이트 페이지의 콘텐츠 범위, CTA, 접근성·라우팅 계약 |
| [PROMO-EXPERIENCE.md](PROMO-EXPERIENCE.md) | 프로모션 브랜드 언어, 메뉴 구조, 실제 제품 화면 증거와 PC·390px 계약 |
| [WORKSPACE-NAVIGATION.md](WORKSPACE-NAVIGATION.md) | 관리자·선생님 권한 메뉴의 빠른 검색, 최근 사용, 키보드·390px 이동 계약 |
| [COMMUNITY-BOARD-ATTACHMENTS.md](COMMUNITY-BOARD-ATTACHMENTS.md) | 공지·게시판 이미지의 정식 첨부 저장, 첨부 실패 후 중복 글 없는 재시도와 권한·반응형 계약 |
| [COMMUNITY-QNA-WORKBENCH.md](COMMUNITY-QNA-WORKBENCH.md) | 관리자 QnA 문제 사진 확대 작업 영역, 답변 보존·등록과 반응형 계약 |
| [TEACHER-WORKSPACE-OPERATIONS.md](TEACHER-WORKSPACE-OPERATIONS.md) | 선생님 오늘 업무 합계, 역할별 결제·알림 경계, 카드 실패 상태와 44px·데스크톱 화면 계약 |
| [TEACHER-SESSION-ASSESSMENTS.md](TEACHER-SESSION-ASSESSMENTS.md) | 차시 시험·과제 종합 조회, 반응형 비교표, 시험 선택 복원과 입력 연결 계약 |
| [TEACHER-OPS-ASSISTANT.md](TEACHER-OPS-ASSISTANT.md) | 사진 기반 학생 식별·수강·ONLINE 영상 권한·초기 알림톡 검토/확정 계약 |
| [MESSAGING-OPERATIONS.md](MESSAGING-OPERATIONS.md) | 알림톡 문구·블록 편집·학생별 미리보기·과제 완료 판정, 발송 기록과 390px UX 계약 |

## 관련 위치

| 용도 | 경로 |
|------|------|
| E2E 테스트 | `frontend/e2e/` |
| 스크립트 | `frontend/scripts/` |
| 배포 | [배포 운영 계약](DEPLOYMENT-OPERATIONS.md): 동일 artifact의 개발 canary·cleanup zero, 승인·운영 반영·rollback |
| 백엔드 문서 | `backend/docs/README.md` |
| 현재 안정화 실행 계획 | [backend hardening-plan](https://github.com/guswls3028-art/academy-backend/blob/main/docs/refactor/hardening-plan.md): 우선 업무·단계·완료 및 재개 조건 |

Actions 공급망과 배포 검증은 [배포 운영 계약](DEPLOYMENT-OPERATIONS.md)이
소유한다. 실행 순서와 Cloudflare 재시도 조건은
[공식 workflow](../.github/workflows/quality-gate.yml)를 따른다.

## E2E 테스트 구조

상세 구조·실행 방법·환경변수: [`frontend/e2e/README.md`](../e2e/README.md)

### 테마와 공용 컨트롤 계약

관리자·교사 앱의 12개 테마는 색상만 바꾸며 버튼·탭·선택 컨트롤의 의미와 상태,
조작 방식은 동일하게 유지한다. 테마 선택 진입점은
`/workspace/settings/appearance`이고 선택값은 브라우저에 저장되어 재방문
시 복원된다.

이 절은 **지켜야 할 의도**를 적는다. 정확한 임계값과 통과 조건은
`e2e/visual/theme-control-states.spec.ts`가 소유하며, 문서와 spec이 어긋나면
spec이 기준이다. 개별 결함을 발견하면 금지 문장을 여기에 덧붙이기보다 spec의
단언으로 옮겨 회귀를 막는다. 아래 원칙으로 설명되지 않는 새 제약만 문서에
추가한다.

**역할과 표면** — 주요 작업은 공용 `Button`, 상태·필터 선택은
`SelectionButton`, 읽기 전용 표시는 `Badge`가 맡는다. 한 컨트롤은 하나의
표면만 가진다. 라벨을 다시 배지나 색상 면으로 감싸거나 컨트롤 안에 또 다른
컨트롤 표면을 넣지 않는다.

**상태 구분** — 기본·호버·선택·포커스·비활성이 서로 구별되어야 한다. 선택은
바깥 윤곽과 강조색으로, 호버는 배경·테두리 변화로 드러낸다. 키보드 포커스는
선택 윤곽과 구분되는 외곽 링으로 표시한다. 불투명도 감소와 비활성 커서는
실제 비활성 상태에만 쓴다.

**대비** — 선택 여부와 무관하게 활성 라벨은 읽히는 대비를 유지한다. 공용
컴포넌트는 밝은 배경을 전제로 한 색을 가질 수 있으므로, 어두운 테마는 그
표면의 글자·배경·테두리를 테마에서 다시 정의할 책임을 진다.

**한국어 라벨과 폭** — 작업·선택 라벨은 한 줄로 유지한다. 공간이 부족하면
그룹을 줄바꿈하거나 명시적인 가로 스크롤로 풀고 글자를 쪼개지 않는다. 폭
배치는 소유 모듈의 CSS에서 해결하며 전역 반응형 CSS로 덮어쓰지 않는다.

**장식** — 장식은 구조를 이루는 요소까지만 둔다. 내용이 없으면 껍데기를 그리지
않고, 맥락 없이 떠 있는 요소는 배경에 남기지 않는다. 짧은 상태 전환 모션은
조작을 돕는 선에서만 쓰고 reduced-motion 설정을 존중한다.

소유 구현은 `src/styles/design-system/colors/themes/index.css`,
`src/shared/ui/ds/Button.tsx`, `src/shared/ui/ds/SelectionButton.tsx`,
`src/styles/design-system/patterns/button.css`,
`src/styles/design-system/patterns/segment-control.css`,
`src/styles/design-system/ds/tabs.css`, `src/auth/themes/`에 있다. 공용 목록
툴바의 모바일 액션 배치는 `DomainListToolbar.module.css`가 소유한다. 새 테마도
기존 테마와 같은 상태·대비 검증을 통과해야 한다.

검증은 `e2e/visual/theme-control-states.spec.ts`의 12개 테마 상태 검사와
실제 적용 화면의 1100px·1366px·390px 조작 검사를 함께 수행한다. 선택 전후
라벨 대비, 단일 표면과 바깥 윤곽, 호버·포커스·비활성 구분, 한 줄 라벨과 그룹
배치를 확인한다. CSS 검사만으로 저장 성공을 판정하지 않으며, 적용 화면에서
클릭 → 결과 → 새로고침 후 유지 및 실패 안내·재시도를 확인한다. 출결 적용
범위와 회귀 항목은 [출결 원장 안전 계약](ATTENDANCE-ROSTER-SAFETY.md)이
소유한다. 아래 명령과 검수 항목은 검증 절차이며 통과 기록을 뜻하지 않는다.
`.github/workflows/e2e.yml`의 PR gate도 이미 빌드한 preview에서 같은 12개 테마
검사를 실행하며, 실패하면 병합 검증을 통과하지 못한다.

```powershell
pnpm build
pnpm exec playwright test --config playwright.theme.config.ts --project=chromium --reporter=list
```

## 스크립트 구조

```
scripts/
├── guard-*.mjs                    ← API·E2E·배포 정책 차단 게이트
├── verify-*.mjs                   ← 역할별 route와 registry 검증
├── generate-api-types.mjs         ← backend OpenAPI 고정본 타입 생성
├── refactor-boundary-snapshot.mjs ← 도메인/대형 파일 부채 예산
├── assets/                        ← 이미지/아이콘 처리 도구
├── dev/                           ← 로컬 개발 유틸
└── tests/                         ← 위 스크립트와 workflow 계약 테스트

e2e/
└── suites.mjs                     ← read-only·route mock·통제 쓰기 Playwright 목록
```

공식 명령은 `package.json`, CI 실행 순서는 `.github/workflows/`, 상세 E2E 작성법은
[`e2e/README.md`](../e2e/README.md)가 소유한다. 일회성 변환·진단 스크립트는
완료 후 live tree에 남기지 않는다.

## 정리 기준

- 일회성 E2E 스펙은 검증 완료 후 삭제 (git history 조회 가능)
- 제품/사용자/운영 문서는 이 폴더에 배치
- 코드 바로 옆에 필요한 모듈 README·refactor note는 `src/<app>/...`에 둘 수 있다. 단, 해당 모듈의 구조·API·검증 범위만 다루고 전역 규칙/운영 절차는 `frontend/docs/` 또는 repo 루트 문서로 올린다.
- 스크린샷과 실행 보고서는 `test-results/`, `playwright-report/` 또는
  workspace `_artifacts/`에 저장하고 커밋하지 않음
