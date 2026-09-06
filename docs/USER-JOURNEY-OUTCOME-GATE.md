# 사용자 여정 결과 게이트

**상태:** 현재 실행 계약
**실행 정본:** `scripts/user-journey-registry.json`,
`scripts/check-user-journey-outcomes.mjs`, frontend quality gate

## 완료의 단위

등록된 일반 제공(GA) 화면을 바꾸는 PR은 guard나 거부 테스트만으로 완료할 수
없다. 유효한 시작 상태에서 역할별 실제 행동, 저장된 제품 결과, reload 후 동일한
상태, 소비 화면 projection, desktop 1366px와 mobile 390px 결과, 알림 의도,
synthetic 데이터 cleanup을 함께 증명한다. 실패/권한/tenant 거부는 이 긍정 여정의
인접 경계이며 대체 증거가 아니다.

첫 registry는 `score-result-messaging`, `omr-manual-descriptive`,
`clinic-state`, `messaging-template-recipient-log`를 등록한다. 화면의 상세 제품 규칙은
`STUDENT-GRADE-REPORT.md`, `GRADING-WRONG-NOTE-WORKFLOW.md`,
`OMR-BATCH-PROGRESS.md`, 각 clinic README, `MESSAGING-OPERATIONS.md`가 소유한다.
Backend 제품·알림 정책은 backend의 `docs/domain/`과 `docs/ssot/`가 소유하며 이
registry가 복제하지 않는다.

## 증거 계층

`executable_evidence`는 현재 deterministic Playwright/controlled-write 자산의
위치와 그것이 증명하는 범위를 선언한다. Route mock 성공을 persistent-development
실사용 또는 운영 검증으로 승격하지 않는다. 일반 제공 여정의 최종 evidence는
production-shaped persistent-development runtime에서 실제 UI와 API로 실행하되
provider send를 비활성화하고, reload/projection/desktop/mobile과 tenant, user,
row, queue, object residue zero를 기록한다.

`seal_status=gap`은 현재 증거가 제품 완료선에 미달한다는 차단 상태다. 영향받은
제품 경로는 본문만으로 통과하지 않는다. `gap -> sealed` 승격과 GA 제품 변경은
모두 그 PR head와 같은 산출물에서 생성한 유효한 machine receipt가 필요하다. 초기
네 journey는 기존 감사 결과를 반영해 모두 `gap`이며, score recipient의 current
main은 parent-only라는 차이도 gap에 명시한다.

영향 경로가 registry와 일치하는 PR은 본문에 backend 문서와 같은
`academy-user-journey-evidence-v1` block을 journey별로 넣어야 한다. Positive action,
persisted outcome, reload persistence, downstream projection을 `guard only`,
`denied only`, `blocked only`, `N/A`, TODO로 채우면 CI가 실패한다. 실행 role ID는
`owner/admin/teacher/staff/student/parent`만 쓰고 Actors, Projection audiences,
역할별 결과를 분리한다. Viewports는 registry 요구값 전체를 포함하고 Executable
evidence는 등록 경로 전체를 인용해야 한다.

Validator는 삭제와 type change를 포함해 base와 현재 registry의 경로 매핑을 합쳐
변경 영향을 계산한다. 기존 journey 삭제, GA를 Beta로 재표시, sealed를 gap으로
되돌리기, actor/projection/evidence/`must_match`/`must_not_match` 축소를 거부한다.
Pattern 교체는 보존되는 positive/negative fixture가 계속 통과할 때만 가능하다.

## Machine receipt

Production-shaped runner는 공식 GitHub Actions에서 실제 API와 exact frontend bundle을
사용한 뒤 `test-results/user-journey-machine-results/<journey-id>.json`을 만든다.
`receipt_policy`가 고정한 valid/invalid case와 audience별 projection을 모두 실행하고,
persisted/reload outcome hash, desktop 1366px/mobile 390px screenshot, 등록 Playwright
JSON report를 남긴다. Backend API 및 네 worker digest, frontend SHA/bundle hash,
release/deployment/instance, PII-free actor, run ID/attempt/workflow, 최대 6시간 expiry도
같이 묶는다. Alimtalk/SMS/LMS/provider ID/network dispatch는 모두 0이어야 하고 tenant,
user, row, queue, object, preview token, provider request cleanup도 모두 0이어야 한다.
알림 의도는 score/messaging의 `explicit_recipients`, OMR의 `no_notification`, clinic의
`separate_optional`을 별도 검증한다.

같은 실행에서 다음 명령으로 file hash와 canonical receipt hash를 발급한다.

```powershell
pnpm journey-receipt:issue -- `
  --machine-result test-results/user-journey-machine-results/score-result-messaging.json `
  --output test-results/user-journey-receipts/score-result-messaging.json
```

Quality gate는 receipt를 다시 열어 exact PR head/current registry/current CI run과 모든
report/screenshot byte hash를 대조한다. 다른 SHA/run, 만료, 누락/skip/flaky/retry,
서술만 있는 결과, provider count나 cleanup residue가 0이 아닌 결과는 실패한다.
통과한 PII-free receipt JSON은 exact head가 포함된 CI artifact로 14일 보존한다.
Receipt용 workflow/test/runner를 먼저 병합하는 PR은 제품 path mapping에서 제외되므로
bootstrap deadlock을 만들지 않는다. 제품 PR은 후보가 임의로 고친 runner가 아니라
이미 병합된 receipt runner를 사용해야 한다. Receipt는 production 배포 승인이 아니며
provider 실발송을 허용하지 않는다.

```powershell
node --test scripts/tests/user-journey-outcomes.test.mjs
node --test scripts/tests/user-journey-receipts.test.mjs
node scripts/check-user-journey-outcomes.mjs
```

두 저장소를 함께 바꾼 제품 여정은 backend와 frontend PR block을 각각 통과하고,
공식 same-artifact QA와 exact SHA release bundle이 모두 확인된 뒤에만 제품 완료다.
