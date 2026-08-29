# 실사용 E2E 인벤토리

**상태:** 현재 실행 계약

이 문서는 반복해서 유지하는 실사용 검증의 목적과 소유 경계를 기록한다. 전체
spec 목록과 과거 pass count는 보관하지 않는다. 실행 목록은
`e2e/suites.mjs`, 배포 연결은 `.github/workflows/e2e.yml`과
`.github/workflows/quality-gate.yml`이 정본이다.

## 1. 실행 계층

| 계층 | 진입점 | 보장 | 제외 |
|------|--------|------|------|
| PR read-only | `test:e2e:gate:readonly` | safety policy, 관리자/학생 login, 최소 smoke를 운영 계정 하나로 직렬 검증 | 생성·수정·발송 |
| PR route mock | `test:e2e:gate:mock` | 모든 활성 `*.mock.spec.ts`, tenant/API payload, 저장·reload·오류 상태, 390px 핵심 surface | 실제 API fallback |
| 수동 전체 gate | `.github/workflows/e2e.yml` | 운영 read-only와 폐쇄 proxy route mock을 병렬 재사용 | 환경이 다른 spec의 혼합 실행 |
| 통제 쓰기 | `test:e2e:controlled-writes` | 가입·복구·공지·QnA·클리닉·평가·OMR·과제 실제 왕복 | 자동 PR 실행, 재시도 |
| 배포 후 canary | `quality-gate.yml` `e2e-roundtrip` | exact production revision에서 bounded 쓰기 후 실패 시 baseline rollback | 독립 수동 실행 |
| 전 메뉴 감사 | `all-menu-button-click-audit.spec.ts` | 역할별 메뉴·조회·닫기·필터의 사람형 클릭, fatal/빈 화면 수집 | 저장·삭제·결제·발송 |
| 주간 시각 감사 | `design-system-route-audit.spec.ts` | 9개 desktop/390px/public surface, overflow·font·escaped HTML·fatal 상태 | 제품 데이터 mutation |

## 2. 실행 구조

`e2e/suites.mjs`는 다음 세 집합을 한 곳에서 소유한다.

- `productionReadOnlySpecs`: 운영 자격증명을 쓰는 네 개의 직렬 PR spec
- `routeMockSpecs`: 폐쇄 proxy에서 병렬 실행할 격리 spec
- `controlledWriteSpecs`: 명시적 opt-in과 residue cleanup이 필요한 쓰기 묶음

`playwright.pr-gate.config.ts`는 운영 read-only를 dependency chain으로 만들고
route mock만 별도 job에서 CI 최대 3 worker로 실행한다. 한 코어는 Vite와 runner에
남겨 cross-file action starvation을 방지하고, `retries: 0`으로 흔들림을 성공으로
가리지 않는다. 운영 계정, shared tenant, PostgreSQL 상태를 공유하는 묶음은
병렬화하지 않는다.

수동 workflow도 위 PR read-only와 route-mock gate를 서로 다른 job으로 병렬
재사용한다. 운영 proxy가 열린 runner와 `127.0.0.1:9` 폐쇄 proxy runner를 섞지
않으므로 mock token이나 누락 요청이 운영 인증/API 경계로 나가지 않는다.
`playwright.controlled-write.config.ts`는 통제 쓰기 manifest를 직접 사용하고
`retries: 0`을 강제해 첫 실패를 재실행으로 숨기거나 같은 mutation을 반복하지
않는다.

운영 로그인은 공통 `e2e/helpers/auth.ts` 한 곳에서만 수행한다. 일반 4xx/5xx는
즉시 실패하고, 429의 서버 지정 대기와 토큰 요청의 일시적 transport 오류만 최대
5회 안에서 재시도한다. spec 전체 재실행으로 실제 결함을 숨기지 않으면서 socket
reset 같은 외부 네트워크 흔들림은 같은 read-only 로그인 경계 안에서 복구한다.

## 3. 최적화된 감사

전 메뉴 감사는 관리자/개발자 desktop, 학생 mobile, 선생님 mobile을 한 job에서
차례로 실행한다. 주간 시각 감사도 9개 route surface를 한 job에서 실행한다.
각 workflow는 checkout, pnpm 설치, Chromium 설치, 안전 guard, 서버/환경 준비를
한 번만 수행한다. 테스트 자체는 계속 직렬이며 실패 artifact에는 모든 scope의
screenshot, trace, HTML report가 함께 남는다.

전 메뉴 감사의 네트워크 결함 수집은 사용자 화면의 API 경계만 소유한다. 별도
운영 계약과 release canary가 소유하는
`/core/product-analytics/events/batch/` telemetry는 이 감사의 결함에 중복
산입하지 않는다. 모바일 drawer는 route 정착 뒤 메뉴 trigger가 마운트될 때까지
bounded wait한 다음 순회한다.

감사 목록에는 현재 canonical route만 둔다. 호환 alias와 외부 redirect는 각각
집중 회귀와 공개 route 감사에서 검증하며 중복 순회하지 않는다. 데이터에 따라
실제 상세 화면으로 이동하는 공개 영상 진입점처럼 의도된 동적 redirect만 spec의
`settlesAt` 패턴으로 명시해, 정상 이동을 stale route 결함으로 오인하지 않는다.

이 구조는 shared tenant 직렬성은 유지하면서 순차 matrix가 반복하던 runner 준비
비용을 제거한다. 새로운 shard는 독립 tenant·계정·데이터와 실행 시간 증거가
있을 때만 추가한다.

## 4. 핵심 사용자 흐름

| 영역 | 반복 증거 |
|------|-----------|
| 인증·첫 사용 | 관리자/학생 login, account recovery modal, first-login guide |
| 관리자 운영 | 수동 채점, 성적 autosave/reload, 직원 운영, 학생 맞춤 컬럼 |
| 학생·학부모 | 성적 조회/제출, 모바일 영상 제어와 CDN 오류, 보호 route |
| 공개·라우팅 | promo/landing router, 단일 요금 CTA, production bundle boot |
| 역할 간 데이터 | 과제 성적/보관함, 영상 차시 흐름 |
| 통제 쓰기 | 가입승인, 계정복구, 공지/QnA/클리닉, 차시평가, OMR, 과제 제출 |

제품 기능을 추가할 때 기존 핵심 흐름과 같은 경계라면 가장 가까운 spec을
확장한다. 별도 제품 규칙이나 fixture 수명주기가 생길 때만 새 spec을 만든다.

## 5. 합격 조건

- 모든 활성 spec은 `strictTest` 또는 명시적 좁은 예외를 사용한다.
- mock spec은 `page.route`로 `/api/v1/` 경계를 가로채며 폐쇄 proxy에서
  누락 요청이 즉시 실패한다.
- 저장 흐름은 요청 payload와 reload 후 상태를 모두 검증한다.
- 모바일 핵심 흐름은 390px에서 가로 overflow, 화면 밖 control, primary action,
  keyboard focus를 검증한다.
- production write는 exact controlled phone/fixture, 명시적 allow flag,
  `retries=0`, 종료 cleanup, backend residue 0을 모두 요구한다.
- 운영 read-only와 shared tenant 감사는 worker 1을 유지한다.
- 배포 후 canary 실패는 성공으로 완화하지 않고 저장된 baseline으로 rollback한다.

## 6. 유지보수와 제거 기준

live tree에는 반복 실행 가능한 회귀 계약만 둔다.

- 날짜성 screenshot/진단/일회성 실사용 spec은 결함을 닫은 뒤 일반화하거나
  삭제한다.
- 실행 결과 보고서와 screenshot dump는 Actions artifact 또는
  `_artifacts/`에 보관하며 `e2e/reports/`를 만들지 않는다.
- 일회성 변환·lint 완화 스크립트는 작업이 끝나면 삭제한다.
- 삭제된 자산은 Git 이력으로 복구할 수 있다. 현재 문서에 과거 run id, 고정
  pass count, 당시 운영 row id를 누적하지 않는다.

## 7. 검증

```powershell
pnpm guard:test-coverage
pnpm guard:e2e-safety
pnpm guard:deployment-governance
pnpm guard:runtime-recovery
pnpm typecheck
pnpm build
pnpm test:e2e:gate
```

로컬 Playwright는 검증할 checkout의 고유 Vite 포트와 `E2E_BASE_URL`을
명시한다. 운영 배포 판정은 exact `version.json` SHA, 공식 workflow 결과,
post-deploy canary와 rollback 상태를 함께 읽는다.
