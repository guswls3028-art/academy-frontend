# E2E Test Suite

Playwright 기반 멀티-테넌트 E2E. 운영 서버(`hakwonplus.com` 등) 대상.

## 구조

```
e2e/
  admin/      관리자 영역 (로그인/대시보드/강의/메시징/매치업/DNB)
  audit/      운영 감사 — CRUD 회귀 (날짜 박힌 일회성은 _local 로 이동)
  auth/       인증 (비밀번호 찾기 모달 등)
  dnb/        DNB 테넌트 운영 검증
  flows/      도메인 왕복 — notice/qna/clinic/exam/guide/real-scenario
  shared/     테넌트 격리/브랜딩/엣지 케이스 공통
  smoke/      스모크 (login/billing/fees/operational)
  stability/  파괴 테스트 + 엣지 검증
  student/    학생 앱
  teacher/    선생님 모바일 앱

  helpers/    auth · api · data · wait · test-fixtures · strictBrowser
  fixtures/   strictTest (zero-defect guard)

  _local/     CI 제외 — 로컬 개발/디버그/스크린샷용 (playwright.config.ts testIgnore)
```

## 실행

```sh
pnpm test:e2e          # 전체 (활성 127 spec)
pnpm test:e2e:gate     # 빠른 게이트 (login admin+student, 수동 검증용)
pnpm test:e2e:headed   # headed 모드
pnpm test:e2e:ui       # UI 모드 (대화형)
pnpm test:e2e:local    # _local/ 만
```

## 환경 변수 (`.env.e2e`)

| 변수 | 기본값 | 용도 |
|------|--------|------|
| `E2E_BASE_URL` | hakwonplus.com | 프론트 |
| `E2E_API_URL` | api.hakwonplus.com | 백엔드 |
| `E2E_ADMIN_USER` / `E2E_ADMIN_PASS` | secrets | Tenant 1 admin |
| `E2E_STUDENT_USER` / `E2E_STUDENT_PASS` | secrets | Tenant 1 학생 |
| `TCHUL_/DNB_/LIMGLISH_*` | secrets | 멀티 테넌트 |
| `E2E_LECTURE_ID` / `E2E_SESSION_ID` | 113 / 153 | 메시징 발송용 강의/차시 |
| `E2E_LECTURE_ID_ALT` / `E2E_SESSION_ID_ALT` | 96 / 158 | 성적 검증용 |
| `E2E_TEST_*` | 0317테스트학생 시리즈 | TEST_RECIPIENT (test-fixtures.ts) |
| `E2E_CLINIC_STUDENT_ID` | (동적 fallback) | 12번 자동 setup 학생 |
| `E2E_STRICT` | `report` (.env.e2e) / `strict` (quality-gate) | strictTest 모드 |

## strictTest 모드

`.fixtures/strictTest.ts` 가 모든 페이지에 console.error/pageerror 리스너 부착.

| `E2E_STRICT` | 동작 |
|--------------|------|
| `strict` (또는 미설정/`1`) | defect 발견 시 spec fail |
| `report` (또는 `warn`)    | defect 을 `console.warn` + test annotation, fail 없음 |
| `off` (또는 `0`)          | 리스너 미부착 |

`DEFAULT_IGNORE` (`helpers/strictBrowser.ts`): chrome-extension, ResizeObserver, `Failed to load resource`, React DevTools, cf-nel.

### 새 strict baseline 만들기

전수 마이그레이션 직후엔 숨은 defect 이 있을 수 있어 **report → strict 점진 전환** 추천:

1. 첫 PR/run 에서 `E2E_STRICT=report` (현재 기본값) 로 정상 통과 확인.
2. `playwright-report/` artifact 의 각 spec annotation `strict-browser-defect` 수집:
   ```sh
   pnpm exec playwright show-report
   ```
3. annotation 의 console.error/pageerror 메시지를 spec 별로 분류:
   - 의도적 음성 시나리오 (404/네트워크 차단) → `baseTest` dual-import 패턴 적용 (예: `auth/password-reset-modal.spec.ts`)
   - 진짜 버그 → 코드 수정
   - 환경 노이즈 (favicon/sentry/analytics) → `attachStrictBrowserGuards` 의 `extraIgnore` 추가
4. 모든 spec 이 깨끗해지면 `.env.e2e` 의 `E2E_STRICT=strict` 로 플립 + PR 1회 dry-run 으로 확인.
5. `quality-gate.yml` 의 e2e-roundtrip 잡은 이미 `E2E_STRICT=strict` — 배포 후 회귀 4개는 엄격.

### 현재 알려진 baseline 후보

정적 분석 (해당 spec 들이 의도적으로 4xx 트리거) 으로 식별된 위험:
- `shared/02-failure-edge-cases.spec.ts` — 404 다수 → DEFAULT_IGNORE 의 `Failed to load resource` 로 해소됨
- `shared/03-tenant-isolation.spec.ts` — 403/404 cross-tenant → 동일
- `shared/04-complaint-prevention.spec.ts` — 404 → 동일
- `auth/password-reset-modal.spec.ts` — baseTest 우회 (이미 적용)
- `stability/final-edge-verify.spec.ts` — baseTest 우회 (이미 적용)

## 토큰 만료

`helpers/api.ts` 의 `apiCall` 이 401 응답 시 `localStorage.refresh` 로 자동 갱신 후 1회 재시도.
긴 폴링 spec (matchup OCR 5분, clinic trigger 등) 에서 access 만료로 인한 silent 401 방지.

## TEST_RECIPIENT SSOT

`helpers/test-fixtures.ts` 의 `TEST_RECIPIENT` 가 **0317테스트학생 / 학생폰 / 학부모폰 / 비밀번호** 를 단일 export.

prod 데이터 변경 시 `.env.e2e` 의 `E2E_TEST_*` 로 override (코드 수정 불필요).

## 12번 (clinic-trigger) 자동 setup

오늘 클리닉 세션 + 참가자가 없으면 `helpers/data.ts::ensureClinicSessionForTrigger` 가 자동 생성.
afterAll 에서 cleanup. silent skip 없이 항상 돌도록 보장.

자동 생성 학생에 `parent_phone` 이 없으면 발송 record 가 없을 수 있어 `recentLogs > 0` 검증은 soft annotation.
실 발송 검증을 강제하려면 `.env.e2e` 의 `E2E_CLINIC_STUDENT_ID=<parent_phone 보유 학생 ID>` 지정.

## 알려진 미해결

- **`page.waitForTimeout(N)` 845+ 호출** — `helpers/wait.ts` 의 `gotoAndSettle` / `clickAndExpect` / `waitForCondition` 으로 점진 마이그레이션. 04 의 `navTo` 는 적용됨.
- **04-messaging-audit silent-pass 다수** — 핵심 진입점 (체크박스/발송 모달) + 실발송 검증은 hard expect 적용. 카테고리 순회 등 의도적 optional path 는 그대로.
- **prod 학생/강의 데이터 의존** — TEST_RECIPIENT/FIXTURES 로 SSOT 화 했지만 일부 spec (matchup-real-user-review 등 _local/) 은 아직 hardcode.
