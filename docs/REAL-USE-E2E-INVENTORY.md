# 실사용 E2E 인벤토리

**상태:** Active
**최초 작성:** 2026-06-05
**목적:** `frontend/e2e`의 기존 테스트 자산을 실사용 운영 리뷰 관점으로 분류한다. 전체 spec 목록이 아니라, 반복 점검에 재사용할 수 있는 핵심 spec과 보강이 필요한 빈틈을 관리한다.

## 1. 재실측 스냅샷

2026-06-05 기준 `frontend/e2e` 활성 파일 재실측.

| 항목 | 값 |
|------|----|
| spec 파일 | 약 193개 |
| `test(` 라인 | 약 855개 |
| skip/annotation 라인 | 약 136개 |
| early `return;` 라인 | 약 201개 |
| `waitForTimeout` 라인 | 약 44개 |
| screenshot 호출 | 약 597개 |
| API helper/request 사용 라인 | 약 234개 |

해석:

- 스크린샷과 페이지 순회 자산은 많다.
- 하지만 skip/early return/API-assisted 흐름이 많아 "실사용 완주"의 증거로는 선별이 필요하다.
- 반복 점검용 spec은 데이터를 만들고, UI로 소비하고, 상대 역할에서 반영을 확인하고, cleanup까지 닫는 형태여야 한다.

## 2. 현재 gate

| 위치 | 현재 역할 | 한계 |
|------|-----------|------|
| `package.json` `test:e2e:gate` | 로그인, smoke, 계정복구, notice/qna/clinic/password, tenant isolation | 강의 생성, 차시 생성, 시험/과제 생성, 영상, 클리닉 판별까지는 닫지 않음 |
| `.github/workflows/quality-gate.yml` `e2e-roundtrip` | 배포 후 notice/qna/clinic/password/session-assessment | `session-assessment`는 read-only 버튼/모달 중심. 실제 시험/과제 생성과 학생 제출은 아님 |
| `.github/workflows/e2e.yml` | PR/수동 전체 E2E | `E2E_STRICT=report`이며 120분 장시간. 실사용 리뷰 판정표가 없음 |

## 3. 재사용 우선 spec

| 영역 | spec | 현재 가치 | 보강 필요 |
|------|------|-----------|-----------|
| 공개 회원가입 승인 | `e2e/flows/signup-approval-roundtrip.spec.ts` | 공개 가입 UI, 관리자 승인 UI, 학생 로그인, cleanup, 통제번호 Alimtalk provider/log 확인까지 하나의 라운드트립으로 검증 | 실발송 run은 `E2E_ALLOW_SIGNUP_APPROVAL_REAL_SEND=1` + `01031217466` 전용. 매 실행 전 통제번호 duplicate pre-flight 필요 |
| 계정복구/교사 비번변경 | `e2e/auth/account-recovery-realuse.spec.ts` | 공용 비밀번호 찾기 UI -> 통제번호 실발송 -> account notification log -> 기존 비번 유지 -> staff reset/restore/delete cleanup | production run은 `E2E_ALLOW_ACCOUNT_RECOVERY_REAL_SEND=1` + `E2E_ACCOUNT_RECOVERY_CONTROLLED_PHONE=01031217466` 필요. temp-login activation은 수신값 env 제공 시 추가 검증 |
| 차시/성적/시험/과제 진입 | `e2e/admin/session-assessment-realuse.spec.ts` | 강의 목록->강의->차시->성적/시험/과제 탭을 실제 클릭으로 확인 | 실제 생성/저장/학생 반영 없음 |
| 학생 시험 결과 | `e2e/student/score-report-realuse.spec.ts` | 강의, 차시, 학생, 시험, 답안, 결과, 성적 보드를 새 데이터로 검증 | 관리자 UI 생성은 API-assisted |
| OMR 업로드/검토/재채점 | `e2e/admin/omr-review-realuse.spec.ts` | 운영 API fixture와 생성 OMR PDF를 사용해 관리자 성적 탭 UI 업로드, worker answer rows, OMR 검토 저장, 학생 성적 projection까지 검증 | fixture 생성은 API-assisted. 테스트 재시도는 운영 잔여를 막기 위해 비활성화 |
| 성적 탭 UX | `e2e/admin/scores-tab-ux.spec.ts` | OMR CTA, 더보기, 편집모드, 발송 차단, 테이블 UX 확인 | 고정 fixture 의존 |
| 공지 왕복 | `e2e/flows/notice-roundtrip.spec.ts` | 관리자 작성->학생 확인 roundtrip | 시각/초심자 판정은 부족 |
| QnA 왕복 | `e2e/flows/qna-roundtrip.spec.ts` | 학생 질문->관리자 답변->학생 확인 | 일부 API-assisted |
| 상담 왕복 | `e2e/flows/counsel-roundtrip.spec.ts` | 상담 신청/관리자 확인 | 상담 UI 입력 체감 검증 부족 |
| 클리닉 왕복 | `e2e/flows/clinic-roundtrip.spec.ts` | 클리닉 세션 생성 후 학생/관리자 화면 로드 | 학생 예약/승인/해소 없음 |
| 클리닉 보강 해소 | `e2e/student/clinic-remediation-realuse.spec.ts` | 실패 성적 -> 클리닉 target -> 학생 예약 -> staff 완료 -> 재시험 통과 -> 학생 result/grades remediated projection | fixture 생성/retake submit은 API-assisted. production run은 controlled notification env 필요 |
| 클리닉 UI 생성 | `e2e/flows/clinic-ui-create.spec.ts` | API로 세션을 만들고 관리자/학생 화면 확인 | 파일 자체에 API-assisted 한계 명시 |
| 영상/세션 렌더 | `e2e/flows/video-session-data-flow.spec.ts` | 관리자/학생 영상/차시 데이터 렌더 확인 | 업로드/READY browser chain은 없음. HLS 재생과 progress persistence는 backend post-deploy smoke/API canary로 별도 통과 |
| 공개 영상 | `e2e/student/03-public-video-refactor.spec.ts` | 공개영상 분리/라벨 확인 | 실제 재생/학습 흐름 없음 |
| 과제/성적/보관함 | `e2e/flows/homework-scores-inventory-data-flow.spec.ts`, `e2e/student/homework-submission-realuse.spec.ts` | 렌더/API shape와 과제 생성->학생 파일 제출->관리자 채점->학생 성적 반영 체인 확인 | 관리자 UI 생성은 아직 API-assisted |
| 운영 전체 스크린샷 | `e2e/flows/real-full-check.spec.ts` | 많은 화면 캡처와 일부 QnA roundtrip | skip/optional branch가 많고 판정표 없음 |
| 운영 시나리오 | `e2e/flows/real-scenario.spec.ts` | 의도한 큰 흐름을 담고 있음 | API setup 중심, cleanup 없음, 실사용 gate로는 위험 |
| 학생 이상행동 guardrail | `e2e/student/student-domain-guardrails.spec.ts` | 비로그인/가짜토큰 보호 라우트, 로그아웃 뒤로가기, 390px 모바일 overflow를 hard expect로 검증 | 상품성 시각 리뷰는 별도 manual 판정표 필요 |

## 4. 실사용 흐름별 커버리지

| 흐름 | 현재 커버리지 | 판정 |
|------|---------------|------|
| 공개 회원가입 신청->관리자 승인->학생 로그인 | `e2e/flows/signup-approval-roundtrip.spec.ts` 운영 실발송 run 통과 | Covered for controlled canary; future runs must keep duplicate pre-flight and controlled number only |
| 관리자 학생 단건 등록->학생 로그인->cleanup | 일부 production QA 기록과 컴포넌트 변경 흔적 | Gap |
| 강의 UI 생성->수강생 등록->정규/보강 차시 생성 | DNB/팝오버/부분 spec 존재 | Gap |
| 차시 출결 입력->학생/교사 반영 | 출결 contract/spec 일부 존재 | Partial |
| 차시 성적 탭->시험/과제 생성 모달 | `session-assessment-realuse` read-only | Partial |
| 시험 생성->학생 응시->자동 채점->성적 보드 | `score-report-realuse` 강함 | Partial, UI 생성 gap |
| OMR 업로드->수동 보정->결과 반영 | `e2e/admin/omr-review-realuse.spec.ts` 운영 통과 | Covered for current gate; fixture setup API-assisted; upload/review/regrade/student projection은 browser+API로 검증 |
| 과제 생성->학생 제출->관리자 채점->학생 성적 | `e2e/student/homework-submission-realuse.spec.ts` 운영 통과 | Covered for current gate; 관리자 생성/채점은 API-assisted |
| 클리닉 대상 판별->예약->승인/출석->해소 | `e2e/student/clinic-remediation-realuse.spec.ts` 운영 통과 | Covered for current gate |
| 영상 업로드->인코딩 READY->학생 재생->시청률 | 렌더/공개영상 + HLS/progress API smoke | Partial, upload/READY browser chain gap |
| 공지/QnA/상담 왕복 | roundtrip spec 존재 | Covered, 시각검수 보강 필요 |
| 알림톡 preview->confirm->provider/log/수신 | 여러 admin spec 존재 | Partial, 통제 발송 runbook 필요 |
| 초심자/비의도 사용 | `e2e/student/student-domain-guardrails.spec.ts` + 계정복구 모달 edge spec | Covered for launch guardrails; broader visual/product audit remains P2 |
| viewport별 상품성 리뷰 | screenshot spec 산재 | Partial, 판정표 연결 필요 |

## 5. 반복 점검 spec 후보

아래는 `REAL-USE-REVIEW-MANUAL.md`와 함께 관리한다.

| 우선순위 | spec 후보 | 핵심 성공 조건 |
|----------|-----------|----------------|
| P1 | `e2e/flows/signup-approval-roundtrip.spec.ts` | 공개 가입 신청이 관리자 승인 후 학생 로그인으로 닫힘. 운영 API에서는 `E2E_ALLOW_SIGNUP_APPROVAL_REAL_SEND=1` + `E2E_SIGNUP_CONTROLLED_PHONE=01031217466` 필요 |
| P1 | `e2e/auth/account-recovery-realuse.spec.ts` | 공용 비밀번호 찾기 실발송, 기존 비번 유지, staff reset/restore, cleanup. 운영 API에서는 `E2E_ALLOW_ACCOUNT_RECOVERY_REAL_SEND=1` + `01031217466` 필요 |
| P1 | `e2e/realuse/lecture-session-supplement.spec.ts` | UI로 강의, 수강생, 정규 차시, 보강 차시 생성 후 교사 모바일 반영 |
| P1 | `e2e/student/clinic-remediation-realuse.spec.ts` | 불합격 시험 결과가 클리닉 대상이 되고 예약/승인/출석 후 해소 |
| P1 | `e2e/student/homework-submission-realuse.spec.ts` | 과제 생성, 학생 제출, 관리자 채점, 학생 성적 반영, cleanup |
| P1 | `e2e/admin/omr-review-realuse.spec.ts` | OMR PDF 생성, 관리자 UI 업로드, worker answer rows, 검토/재채점, 학생 성적 반영, cleanup |
| P2 | `e2e/realuse/video-playback-chain.spec.ts` | READY 영상이 학생에게 노출되고 재생/이어보기/시청률이 반영 |
| P2 | `e2e/student/student-domain-guardrails.spec.ts` | 비로그인/가짜 토큰, 로그아웃 뒤로가기, 모바일 overflow 검증 |
| P2 | `e2e/realuse/visual-product-audit.spec.ts` | 핵심 화면 viewport별 screenshot과 overflow/overlap DOM check |

## 6. 선별 기준

실사용 리뷰 gate에 올릴 spec은 아래 조건을 만족해야 한다.

- 테스트 데이터는 `[E2E-{timestamp}]`로 생성한다.
- 가능한 경우 UI로 생성하고, API는 setup/cleanup 또는 backend 상태 검증에만 쓴다.
- 데이터 없는 환경을 skip하면 그 시나리오는 PASS가 아니다.
- 생성한 데이터 ID를 기록하고 cleanup한다.
- 역할 A에서 만든 상태를 역할 B에서 확인한다.
- `E2E_STRICT=strict`에서 console error/pageerror가 없어야 한다.
- 시각검수 spec은 screenshot만 남기지 말고 판정 가능한 DOM metric 또는 수동 판정표를 연결한다.

## 7. 기존 spec 정리 방향

| 분류 | 처리 |
|------|------|
| 실제 chain canary | `e2e/realuse`로 승격 또는 package script에 묶음 |
| read-only smoke | `smoke` 또는 기존 위치 유지 |
| 일회성 screenshot audit | 검증 종료 후 `_local` 또는 archive 후보 |
| API-assisted setup이 명확한 spec | 파일 상단에 한계 유지, 실사용 gate에는 단독 사용 금지 |
| cleanup 없는 prod 데이터 spec | 실사용 gate 후보에서 제외하고 cleanup 추가 전까지 수동 전용 |

## 8. 권장 실행 묶음

L1 실사용 canary 최소 묶음:

```powershell
cd C:\academy\frontend
pnpm exec playwright test e2e/flows/signup-approval-roundtrip.spec.ts --reporter=list
pnpm exec playwright test e2e/student/score-report-realuse.spec.ts --reporter=list
pnpm exec playwright test e2e/admin/session-assessment-realuse.spec.ts --reporter=list
pnpm exec playwright test e2e/admin/omr-review-realuse.spec.ts --reporter=list
pnpm exec playwright test e2e/auth/account-recovery-realuse.spec.ts --reporter=list
pnpm exec playwright test e2e/student/clinic-remediation-realuse.spec.ts --reporter=list
pnpm exec playwright test e2e/student/student-domain-guardrails.spec.ts --reporter=list
pnpm exec playwright test e2e/student/homework-submission-realuse.spec.ts --reporter=list
pnpm exec playwright test e2e/flows/notice-roundtrip.spec.ts e2e/flows/qna-roundtrip.spec.ts --reporter=list
```

운영 API에서 signup approval spec을 실행할 때는 반드시 통제번호 충돌을 먼저 확인한다.
2026-06-07 KST follow-up에서 기존 충돌 fixture는 삭제/영구삭제했고, 통제번호
`01031217466` 실발송 canary는 통과했다. spec의 production guard는 여전히 정확한
통제번호와 explicit allow flag 없이는 실행을 차단하는 것이 정상이다.

2026-06-07 KST Phase 2 pass에서 `pnpm test:e2e:gate`는 production bundle/API 기준
35 passed로 통과했다. 이 gate는 signup approval spec을 포함하지 않으므로, 공개 가입
승인 실발송 증거는 위 통제번호 blocker가 해소된 뒤 별도 실행한다.

2026-06-07 KST Phase 2 hardening follow-up에서 운영 API + local bundle 기준으로
아래를 추가 검증했다.

- `pnpm test:e2e:gate`: 35 passed.
- `e2e/student/score-report-realuse.spec.ts` +
  `e2e/admin/session-assessment-realuse.spec.ts`: 2 passed.
- `e2e/flows/counsel-roundtrip.spec.ts`,
  `e2e/flows/exam-data-flow.spec.ts`,
  `e2e/flows/homework-scores-inventory-data-flow.spec.ts`,
  `e2e/flows/video-session-data-flow.spec.ts`: 37 passed, 2 skipped.
  - skipped 2건은 현재 운영 fixture에서 학생에게 접근 가능한 시험 문항/결과가 없어
    제출·결과 확인을 조건부 skip한 것이다.
  - `exam-data-flow`는 비수강/비배정 시험 상세 직접 URL 접근이 빠르게 fail-closed
    되는지 확인한다.
  - `exam-data-flow`는 생성한 `E2E Test Exam` template을 test cleanup과
    `afterAll`에서 정리한다.
- 운영 cleanup 재확인: `E2E Test Exam` 0건, `[E2E] 상담 신청` 0건.

2026-06-07 KST launch-readiness follow-up에서 추가로 아래를 닫았다.

- `E2E_ALLOW_SIGNUP_APPROVAL_REAL_SEND=1`,
  `E2E_SIGNUP_CONTROLLED_PHONE=01031217466`,
  `E2E_SIGNUP_EXPECT_ALIMTALK=1`
  `pnpm exec playwright test e2e/flows/signup-approval-roundtrip.spec.ts --reporter=list`:
  1 passed.
  - Tenant 1 auto-approve setting이 켜져 있으면 spec이 manual approval로 전환하고
    afterAll에서 원래 설정으로 복구한다.
  - latest provider/log proof: account notification log `id=2839`,
    `target_id=parent:1932:01031217466`.
  - cleanup 후 통제번호 duplicate check는 `available=true`.
- `pnpm exec playwright test e2e/student/score-report-realuse.spec.ts --reporter=list`:
  1 passed. cleanup은 detail delete 대신 bulk delete/permanent delete를 사용한다.
- `pnpm exec playwright test e2e/student/dashboard-redesign.spec.ts e2e/student/dashboard-dark.spec.ts e2e/mobile-narrow-viewport-20260512.spec.ts --reporter=list`:
  14 passed.
- 영상 HLS/progress는 backend post-deploy smoke/API canary에서 별도 통과:
  lecture `136`, session `159`, video `284`, enrollment `1052`.

2026-06-07 KST homework follow-up에서 운영 API + production bundle 기준으로
아래를 추가 검증했다.

- `pnpm exec eslint e2e/student/homework-submission-realuse.spec.ts`: passed.
- `pnpm exec playwright test e2e/student/homework-submission-realuse.spec.ts --reporter=list`:
  1 passed.
  - Admin API로 강의/차시/학생/과제를 생성하고, 학생 브라우저에서 실제 PNG 파일을
    제출한 뒤, 관리자 scoring API로 `92/100`을 기록하고 학생 성적 UI 반영을 확인했다.
  - Backend delete guard 배포 후 이전 잔여 `session=296`, `lecture=297` 삭제가
    각각 `204`로 성공했고, active `[E2E-...] 과제체인` 강의/차시/학생 프로브는
    모두 0건이었다.

2026-06-07 KST OMR follow-up에서 운영 API + production bundle 기준으로 아래를
추가 검증했다.

- `pnpm exec eslint e2e/admin/omr-review-realuse.spec.ts`: passed.
- `pnpm exec playwright test e2e/admin/omr-review-realuse.spec.ts --reporter=list`:
  1 passed.
  - Admin API로 강의/차시/학생/시험/정답/시험 배정을 만들고, 운영 API에서 생성한
    OMR PDF를 관리자 성적 탭 UI에 실제 업로드했다.
  - Worker가 submission answer rows를 저장한 뒤 OMR 검토 워크스페이스에서 학생을
    선택하고 답안을 `1,2,4,4,1`로 보정해 `60/100` 재채점을 확인했다.
  - 학생 `/student/grades` UI가 같은 시험명을 표시했고, 결과 API의 오답 번호는
    `[3,5]`였다.
  - Active OMR canary 강의/차시/학생 residue는 0건이었다. 비활성 archived exam
    `399`, `400`은 결과 이력 보존 delete guard `403`이 정상 동작한 것이다.

2026-06-07 KST student-domain launch seal에서 운영 API + production bundle 기준으로
아래를 추가 검증했다.

- `pnpm exec playwright test e2e/auth/account-recovery-realuse.spec.ts --reporter=list`:
  1 passed.
  - 공용 비밀번호 찾기 UI가 통제번호 `01031217466`으로 실제 알림톡을 발송했고,
    account notification log는 `sent` 상태와 마스킹된 수신자 요약을 반환했다.
  - 기존 비밀번호는 public recovery 직후 그대로 유효했고, staff reset은 생성한
    E2E 학생만 변경한 뒤 원복/삭제했다.
- `pnpm exec playwright test e2e/student/clinic-remediation-realuse.spec.ts --reporter=list`:
  1 passed.
  - 실패 시험 결과가 클리닉 대상이 되고, 학생 예약/내 일정/승인/완료/재시험 통과 후
    학생 결과와 성적 화면에서 보강 합격으로 바뀌었다.
- `pnpm exec playwright test e2e/student/student-domain-guardrails.spec.ts --reporter=list`:
  3 passed.
  - 비로그인/가짜 토큰 보호 라우트, 로그아웃 후 뒤로가기, 390px 모바일 overflow를
    hard expect로 검증했다.

L2 상품성 리뷰는 자동 spec만으로 닫지 않는다. `REAL-USE-REVIEW-MANUAL.md`의 시각/상품성 판정표와 `_artifacts/realuse-review/{timestamp}/summary.md`를 함께 작성한다.
