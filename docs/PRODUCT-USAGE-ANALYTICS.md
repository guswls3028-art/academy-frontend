# 제품 사용 분석 프런트엔드 계약

**상태:** 내부 `hakwonplus` 단일 테넌트 28일 파일럿 진행 중

**백엔드 정본:** [product-usage-analytics.md](https://github.com/guswls3028-art/academy-backend/blob/main/docs/domain/product-usage-analytics.md)

**최초 분석 merge:** `ab32657e7e6846ae3aaf272e57b12dbd0dd9b672`

## 1. 목적과 범위

선생님·직원, 학부모, 학생이 등록된 인증 화면을 방문하고 실제 CTA를
보거나 선택하며 대표 업무를 완료·실패하는 흐름을 익명 신호로 만든다.
이 신호는 28일 기준선 이후 메뉴, 홈 카드, CTA 문구·위치와 우선순위를
수동으로 검토하는 근거다.

공개 랜딩, 키 입력, 검색어, 메시지·답안·점수, DOM snapshot, 모든
클릭과 세션 replay는 이 모듈의 범위가 아니다.

## 2. 실행 경계

`ProductAnalyticsProvider`는 인증 라우터 전체를 감싸지만 다음 조건을
모두 만족할 때만 활성화된다.

- 인증 사용자가 있다.
- 현재 pathname이 route registry에 등록되어 있다.
- 현재 Program의
  `feature_flags.product_usage_analytics_enabled === true`다.

조건이 하나라도 없으면 view ID와 이벤트를 만들지 않는다. 로그아웃이나
인증 초기화 시 메모리 queue와 sessionStorage의 익명 session ID를
폐기한다.

테넌트별 운영 전환은 플랫폼 테넌트 상세 화면 또는
`.github/workflows/product-analytics-rollout.yml`만 사용한다. 수동
workflow는 exact tenant code와 `ENABLE <code>`/`DISABLE <code>` 확인
문구를 요구하고, GitHub secret의 플랫폼 계정으로 정식 tenant API를
호출한 뒤 응답 flag를 readback한다. 토큰과 비밀번호는 출력하지 않는다.

현재 registry는 22개 안정 feature ID와 68개 인증 route template을
검증한다. 실행 SSOT는 다음 두 파일이다.

- `src/shared/productAnalytics/featureRegistry.ts`
- `src/shared/productAnalytics/routeRegistry.ts`

feature ID와 screen ID는 소문자 영문·숫자·마침표·하이픈만 사용한다.
배포한 ID를 다른 의미로 재사용하지 않는다. 실제 URL의 숫자·UUID,
query와 hash를 route template으로 보내지 않는다.

## 3. 자동 수집

### 화면

- route 진입 시 `screen_view` 한 건
- 문서가 실제 visible인 누적 시간 10초 후 `screen_engaged` 한 건
- background 시간은 10초에 포함하지 않는다.

### 내부 진입 CTA

같은 origin의 등록된 `<a href>`와
`data-analytics-destination` 요소를 관찰한다.

- 요소 50% 이상이 500ms 연속 보이면 view당 `cta_impression` 한 건
- 실제 선택 시 `cta_click`
- 위치는 명시된 `data-analytics-placement`를 우선 사용하고, 없으면
  sidebar·header·navigation·content로 제한해 추론
- 같은 부모 안의 등록 목적지 순서를 `position_index`로 기록
- 외부 URL과 등록되지 않은 목적지는 무시

비내비게이션 버튼은 `TrackedCta`로 안정 `ctaId`, `placementId`,
선택적 `positionIndex`를 명시한다.

### 대표 업무

`useTrackedTask(actionId, operation)`은 기존 Promise를 감싸 다음을
기록한다.

1. 호출 직전 `task_start`
2. Promise 성공 후 `task_success`
3. 오류 시 `task_failure`와 제한된 failure category
4. 원래 반환값 또는 원래 오류를 그대로 호출자에게 전달

현재 연결 범위는 선생님 출석·성적 저장·시험/과제 대상 저장·알림톡
발송 요청, 학생 시험/과제 제출, 학생·학부모 클리닉 대표 작업이다.
안정 action ID는 다음과 같다.

- `scores.session.save`
- `exams.enrollment.save`
- `assignments.enrollment.save`
- `messaging.alimtalk.request`
- `assignments.student.submit`

알림톡 task 성공은 발송 완료가 아니라 기존 API의 발송/예약 요청이
오류 없이 반환된 뜻이다. 실제 전달 성공·실패는 기존 발송 내역 계약을
따른다. 분석 이벤트를 위해 업무 API 성공을 낙관하거나 오류를 삼키지
않는다.

## 4. 이벤트 queue와 실패 동작

- 이벤트는 페이지 메모리에서만 보관한다.
- 10건 또는 5초마다 flush하며 API batch는 최대 20건이다.
- queue는 최신 100건으로 제한한다.
- 전송 timeout은 4초다.
- 한 번 실패한 batch만 1회 재시도하고 계속 실패하면 버린다.
- 수집 오류 toast, blocking spinner와 업무 rollback을 만들지 않는다.
- localStorage나 IndexedDB에 행동 이벤트를 보존하지 않는다.

클라이언트는 event, session, view, interaction UUID와 안정 ID,
surface, route template, 위치·순서, device class, client release,
catalog version, synthetic 여부만 전송한다. tenant, user, role,
학생·학부모·도메인 entity ID와 자유 형식 properties를 전송하지
않는다. 서버가 tenant와 역할을 독립 검증한다.

## 5. 운영 화면

플랫폼 운영자 전용 `/dev/product-analytics`는 다음을 제공한다.

- 7·28·90일 기간
- 원본 role, surface와 tenant 필터
- 활성 actor, 화면 방문, 10초 참여율, task 완료·실패율
- feature별 방문·참여·시작·성공·실패·마지막 관측
- CTA placement·position별 노출·클릭률
- raw, synthetic, impersonated 이벤트 품질
- 단일 tenant 고유 actor 1~4명인 경우 suppressed 상태

화면의 권고 배지는 자동 재정렬 명령이 아니다. 실패율이 높은 흐름을
먼저 고치고, 핵심·희소 기능을 단순 저사용으로 숨기지 않으며, 적격
28일 기준선 전에는 위치를 바꾸지 않는다.

## 6. 기능 추가 규칙

새 인증 화면:

1. 기존 목적의 feature ID가 있으면 재사용한다.
2. route registry에 canonical route template, screen ID와 surface를
   추가한다.
3. 새 feature라면 expected frequency와 strategic priority를 함께
   등록한다.
4. registry 검증을 실행한다.

새 CTA:

- 등록 내부 목적지면 기본 observer를 우선 사용한다.
- 버튼 업무면 `TrackedCta`에 안정 ID와 위치를 명시한다.
- 텍스트, entity ID, 사용자 입력을 ID에 포함하지 않는다.

새 task funnel:

- 실제 서버 성공을 반환하는 기존 operation 경계를 감싼다.
- 한 업무 시도는 하나의 interaction ID를 공유한다.
- validation, network, permission, server, unknown 이외의 오류 원문을
  이벤트에 넣지 않는다.
- 수집 OFF 또는 분석 장애일 때 기존 사용자 흐름이 동일해야 한다.

## 7. 검증

Focused:

```powershell
node --test scripts/tests/product-analytics-registry.test.mjs
node scripts/verify-product-analytics-registry.mjs
pnpm typecheck
pnpm exec playwright test e2e/shared/product-analytics-contract.mock.spec.ts
```

registry 검증은 feature·route 중복, 안정 ID, canonical workspace route,
query/hash·raw UUID, primary navigation placement와 button destination
observer를 확인한다. 같은 Node 계약은 대표 task action ID가 실제 API
Promise 경계를 계속 감싸는지도 확인한다.

route-mocked Chromium 계약은 다음을 증명한다.

- 플래그 OFF: flush 시간 이후 analytics request와 session ID가 모두 0
- 플래그 ON: canonical 익명 `screen_view` batch 발생
- payload에 raw user·tenant identity가 없음

`guard:test-coverage`가 registry·대표 task Promise 경계 계약을 PR의
API/E2E safety gate에서 항상 실행한다.

배포 전 전체 quality gate는 typecheck, API/E2E guard, lint, build,
격리 preview를 통과한 뒤 Cloudflare 운영 기준선과 배포 소유권을
확인한다. Cloudflare Git production auto-deploy가 켜져 있으면 운영
배포 전에 실패해야 한다. 정식 direct deploy 후 운영 revision 전파와
tenant·login·왕복·실사용 E2E를 통과해야 완료다.

Cloudflare API가 production 자동배포 플래그 변경을 성공으로 응답한
뒤에도 기존 값을 유지하는 계정에서는 production branch를
`github-actions-production`으로 예약해 배포 소유권을 분리한다. 이
브랜치는 GitHub에 생성하지 않으며 quality workflow가 매 운영 승격
전에 404를 확인한다. Cloudflare Git은 main과 PR의 preview만 만들고,
quality workflow는 예약 브랜치 이름으로 검증된 산출물을 명시적으로
production에 승격한다. 예약 브랜치가 실제 GitHub에 생기거나 다른
production branch로 바뀌면 운영 배포는 fail-closed 한다.

## 8. 현재 운영 상태

`hakwonplus`는 정식 rollout workflow `30504193527`로 2026-07-30에
활성화되어 2026-08-12 기준 28일 파일럿의 14번째 달력일을 진행 중이다.
확인된 외부 테넌트는 비활성 상태를 유지한다. 파일럿 중에도 메뉴·CTA
위치와 문구는 자동 변경하지 않으며 2026-08-26 첫 28일 판정 전에는
제품 우선순위 변경 근거로 확정하지 않는다.

백엔드 daily gate가 활성 tenant 범위, 최근 다른 tenant 이벤트, HMAC,
DB 시간·write 비중과 90일 저장 전망을 감시한다. hard gate 자동 해제와
운영 비용 판단은 백엔드 정본을 따른다.
