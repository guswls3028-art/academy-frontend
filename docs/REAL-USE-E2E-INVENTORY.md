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
| 공개 회원가입 승인 | `e2e/flows/signup-approval-roundtrip.spec.ts` | 공개 가입 UI, 관리자 승인 UI, 학생 로그인, cleanup을 하나의 라운드트립으로 검증 | 운영 실행은 `01031217466` 통제번호가 활성 E2E fixture에 묶여 있어 현재 차단 |
| 차시/성적/시험/과제 진입 | `e2e/admin/session-assessment-realuse.spec.ts` | 강의 목록->강의->차시->성적/시험/과제 탭을 실제 클릭으로 확인 | 실제 생성/저장/학생 반영 없음 |
| 학생 시험 결과 | `e2e/student/score-report-realuse.spec.ts` | 강의, 차시, 학생, 시험, 답안, 결과, 성적 보드를 새 데이터로 검증 | 관리자 UI 생성은 API-assisted |
| 성적 탭 UX | `e2e/admin/scores-tab-ux.spec.ts` | OMR CTA, 더보기, 편집모드, 발송 차단, 테이블 UX 확인 | 고정 fixture 의존 |
| 공지 왕복 | `e2e/flows/notice-roundtrip.spec.ts` | 관리자 작성->학생 확인 roundtrip | 시각/초심자 판정은 부족 |
| QnA 왕복 | `e2e/flows/qna-roundtrip.spec.ts` | 학생 질문->관리자 답변->학생 확인 | 일부 API-assisted |
| 상담 왕복 | `e2e/flows/counsel-roundtrip.spec.ts` | 상담 신청/관리자 확인 | 상담 UI 입력 체감 검증 부족 |
| 클리닉 왕복 | `e2e/flows/clinic-roundtrip.spec.ts` | 클리닉 세션 생성 후 학생/관리자 화면 로드 | 학생 예약/승인/해소 없음 |
| 클리닉 UI 생성 | `e2e/flows/clinic-ui-create.spec.ts` | API로 세션을 만들고 관리자/학생 화면 확인 | 파일 자체에 API-assisted 한계 명시 |
| 영상/세션 렌더 | `e2e/flows/video-session-data-flow.spec.ts` | 관리자/학생 영상/차시 데이터 렌더 확인 | 업로드, READY, 재생, 시청률 없음 |
| 공개 영상 | `e2e/student/03-public-video-refactor.spec.ts` | 공개영상 분리/라벨 확인 | 실제 재생/학습 흐름 없음 |
| 과제/성적/보관함 | `e2e/flows/homework-scores-inventory-data-flow.spec.ts` | 학생 grades/submit/inventory 렌더와 API shape 확인 | 과제 생성->학생 제출->채점 chain 없음 |
| 운영 전체 스크린샷 | `e2e/flows/real-full-check.spec.ts` | 많은 화면 캡처와 일부 QnA roundtrip | skip/optional branch가 많고 판정표 없음 |
| 운영 시나리오 | `e2e/flows/real-scenario.spec.ts` | 의도한 큰 흐름을 담고 있음 | API setup 중심, cleanup 없음, 실사용 gate로는 위험 |

## 4. 실사용 흐름별 커버리지

| 흐름 | 현재 커버리지 | 판정 |
|------|---------------|------|
| 공개 회원가입 신청->관리자 승인->학생 로그인 | `e2e/flows/signup-approval-roundtrip.spec.ts` 구현 | Partial, 운영 실발송 run은 통제번호 fixture 충돌 해소 필요 |
| 관리자 학생 단건 등록->학생 로그인->cleanup | 일부 production QA 기록과 컴포넌트 변경 흔적 | Gap |
| 강의 UI 생성->수강생 등록->정규/보강 차시 생성 | DNB/팝오버/부분 spec 존재 | Gap |
| 차시 출결 입력->학생/교사 반영 | 출결 contract/spec 일부 존재 | Partial |
| 차시 성적 탭->시험/과제 생성 모달 | `session-assessment-realuse` read-only | Partial |
| 시험 생성->학생 응시->자동 채점->성적 보드 | `score-report-realuse` 강함 | Partial, UI 생성 gap |
| OMR 업로드->수동 보정->결과 반영 | 여러 OMR/Matchup/score spec 존재 | Partial, 운영 chain 선별 필요 |
| 과제 생성->학생 제출->관리자 채점->학생 성적 | 렌더/API shape 중심 | Gap |
| 클리닉 대상 판별->예약->승인/출석->해소 | 개별 backend/frontend 조각 존재 | Gap |
| 영상 업로드->인코딩 READY->학생 재생->시청률 | 렌더/공개영상 중심 | Gap |
| 공지/QnA/상담 왕복 | roundtrip spec 존재 | Covered, 시각검수 보강 필요 |
| 알림톡 preview->confirm->provider/log/수신 | 여러 admin spec 존재 | Partial, 통제 발송 runbook 필요 |
| 초심자/비의도 사용 | edge-case spec 산재 | Gap, 전용 묶음 필요 |
| viewport별 상품성 리뷰 | screenshot spec 산재 | Partial, 판정표 연결 필요 |

## 5. 반복 점검 spec 후보

아래는 `REAL-USE-REVIEW-MANUAL.md`와 함께 관리한다.

| 우선순위 | spec 후보 | 핵심 성공 조건 |
|----------|-----------|----------------|
| P1 | `e2e/flows/signup-approval-roundtrip.spec.ts` | 공개 가입 신청이 관리자 승인 후 학생 로그인으로 닫힘. 운영 API에서는 `E2E_ALLOW_SIGNUP_APPROVAL_REAL_SEND=1` + `E2E_SIGNUP_CONTROLLED_PHONE=01031217466` 필요 |
| P1 | `e2e/realuse/lecture-session-supplement.spec.ts` | UI로 강의, 수강생, 정규 차시, 보강 차시 생성 후 교사 모바일 반영 |
| P1 | `e2e/realuse/assessment-clinic-chain.spec.ts` | 불합격 시험 결과가 클리닉 대상이 되고 예약/승인/출석 후 해소 |
| P1 | `e2e/realuse/homework-submission-chain.spec.ts` | 과제 생성, 학생 제출, 관리자 채점, 학생 성적 반영 |
| P2 | `e2e/realuse/video-playback-chain.spec.ts` | READY 영상이 학생에게 노출되고 재생/이어보기/시청률이 반영 |
| P2 | `e2e/realuse/beginner-misuse.spec.ts` | 빈 입력, 중복 클릭, 뒤로가기, 모바일 키보드, 중복 예약 오류 검증 |
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
pnpm exec playwright test e2e/flows/notice-roundtrip.spec.ts e2e/flows/qna-roundtrip.spec.ts --reporter=list
```

운영 API에서 signup approval spec을 실행할 때는 반드시 통제번호 충돌을 먼저 해소한다. 현재
Tenant 1에서 `01031217466`은 활성 E2E fixture 학생/학부모 번호로 사용 중이므로, spec의
production guard가 실행을 차단하는 것이 정상이다.

2026-06-07 KST Phase 2 pass에서 `pnpm test:e2e:gate`는 production bundle/API 기준
35 passed로 통과했다. 이 gate는 signup approval spec을 포함하지 않으므로, 공개 가입
승인 실발송 증거는 위 통제번호 blocker가 해소된 뒤 별도 실행한다.

L2 상품성 리뷰는 자동 spec만으로 닫지 않는다. `REAL-USE-REVIEW-MANUAL.md`의 시각/상품성 판정표와 `_artifacts/realuse-review/{timestamp}/summary.md`를 함께 작성한다.
