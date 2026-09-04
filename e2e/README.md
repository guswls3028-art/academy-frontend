# E2E 테스트

Playwright 테스트의 실행 진입점과 안전 경계다. 배포·권한 정책은
`docs/DEPLOYMENT-OPERATIONS.md`, 반복 실행할 suite 목록은
`e2e/suites.mjs`가 소유한다.

## 디렉터리

```
e2e/
├── admin/       관리자 화면과 운영 도구
├── auth/        로그인·계정 복구·첫 사용
├── dnb/         DNB tenant 전용 검증
├── flows/       역할을 넘는 사용자 왕복
├── fixtures/    strictTest와 파일 fixture
├── helpers/     인증·API·대기·브라우저 공통 계약
├── refactor/    라우팅/구조 회귀
├── shared/      tenant·브랜딩·공통 안전성
├── smoke/       최소 상태/배포 smoke
├── stability/   메뉴 전수와 명시적 파괴 fixture 감사
├── student/     학생·학부모 앱
├── teacher/     선생님 앱
├── visual/      유지되는 route-surface 시각 감사
└── suites.mjs   read-only·route mock·통제 쓰기 suite 단일 목록
```

실행 결과는 `test-results/`, HTML은 `playwright-report/`에 생성하며 Git에
커밋하지 않는다. 날짜가 박힌 진단 spec이나 실행 결과 보고서는 live tree에
보관하지 않고 Actions artifact와 Git 이력에서 조회한다.

## 공식 명령

| 명령 | 범위 | 네트워크/쓰기 경계 |
|------|------|--------------------|
| `pnpm test:e2e:gate` | PR 전체 gate | 운영 read-only 4개는 직렬, route mock은 폐쇄 proxy에서 병렬 |
| `pnpm test:e2e:gate:readonly` | 운영 login/smoke allowlist | 한 계정·한 worker dependency chain |
| `pnpm test:e2e:gate:mock` | 모든 활성 `*.mock.spec.ts` | `127.0.0.1:9` proxy, 실제 API 요청 금지 |
| `pnpm test:e2e:controlled-writes` | 통제 쓰기 canary | 명시적 workflow opt-in, 재시도 0 |
| `pnpm test:e2e:bundle-smoke` | 빌드 산출물 부팅 | 로컬 preview, strict browser |
| `pnpm test:e2e:youtube-integration` | 실제 YouTube SDK 준비·재생·일시정지 | 로컬 앱·합성 API, 공개 YouTube SDK/미디어만 실제 통신, 재시도 0 |
| `pnpm test:e2e:visual-audit` | 9개 운영 route surface | read-only, 한 job·한 browser 설치·직렬 실행 |

`pnpm test:e2e`는 연구/진단 spec까지 포함한 전체 디렉터리를 실행하므로 릴리스
합격 기준으로 사용하지 않는다. 기능 변경은 가장 가까운 focused spec을 먼저
실행하고 위 공식 gate로 닫는다.

## 로컬 실행

검증할 checkout에서 고유 포트로 Vite를 시작하고 같은 URL을 명시한다. 이미 떠
있는 5173 서버를 재사용하면 다른 revision을 검증할 수 있다.

```powershell
pnpm dev --host 127.0.0.1 --port 5174 --strictPort
$env:E2E_BASE_URL = "http://127.0.0.1:5174"
$env:E2E_LOCAL_BASE_URL = "http://127.0.0.1:5174"
pnpm exec playwright test e2e/admin/example.mock.spec.ts --project=chromium --workers=1 --retries=0
```

운영 API를 쓰지 않는 route mock은
`$env:VITE_DEV_PROXY_TARGET = "http://127.0.0.1:9"`로 fail-closed 한다.
`.env.e2e.example`을 복사해 로컬 자격증명을 넣되 파일은 커밋하지 않는다.

## 안전 계약

- 활성 spec은 `e2e/fixtures/strictTest.ts`에서 `test`와 `expect`를 가져온다.
  예외는 `E2E_STRICT_IMPORT_EXCEPTION` marker가 있는 좁은 allowlist만 허용한다.
- PR에서는 `E2E_ALLOW_PRODUCTION_WRITES=0`과
  `E2E_ALLOW_REAL_ALIMTALK=0`을 유지한다.
- 실제 알림톡·계정복구·가입승인·OMR·과제·클리닉 canary는
  `controlled_write_canaries=true`인 수동 workflow에서만 실행한다.
- 통제 쓰기는 `playwright.controlled-write.config.ts`가 재시도 0을 강제한다.
  생성 row/object는 exact run token으로 정리하고 backend residue 0 readback까지
  완료한다.
- 운영 login fixture는 조회 전용이다. 생성·수정·삭제 spec은 소유 fixture를
  만들고 성공/실패 모두 정리한다.
- shared tenant와 운영 계정을 사용하는 묶음은 worker 1과 직렬 실행을 유지한다.
  route mock만 격리가 증명되어 최대 4 worker를 사용한다.

`pnpm guard:e2e-safety`는 suite 중복·누락 파일·route interception·쓰기
분리·자격증명 흔적·strict import를 검사한다. 새 `*.mock.spec.ts`는
`e2e/suites.mjs`의 `routeMockSpecs`에 등록하지 않으면
`pnpm guard:test-coverage`가 실패한다.

## 반복 감사

### YouTube 응답 순서 회귀와 실제 SDK 검증

`student/video-cdn-service-error.mock.spec.ts`의 playback v2/access v2 응답 순서
회귀는 앱의 정책 일치·재시도·이전 CDN 재사용 금지를 검증한다. 해당 case만
`helpers/youtubeSdkFixture.ts`로 외부 SDK를 대체한다. 실제 SDK 로딩 속도나
공급자 스크립트의 Permissions Policy 오류가 이 앱 순서 검증에 섞이지 않도록
분리한 것이며 영상 제품 코드·권한·공용 strict console 정책은 변경하지 않는다.
다른 영상 case의 외부 SDK 사용까지 일괄 변경하지 않는다.

fixture는 실제 앱의 `iframe_api` 로더를 통과하고 비동기 SDK-ready/플레이어-ready,
재생·일시정지 상태 이벤트, 시간 조회, 음량·배속·seek·destroy 메서드를 제공한다.
같은 spec의 fixture 계약 테스트는 앱 화면과 SDK 호출 기록으로 ready→사용자 재생→
시간 증가→일시정지를 확인하고, 제어된 `onError(150)` 후 오류 UI·destroy·다시 시도·
새 플레이어 복구를 확인한다. SDK fixture 밖으로 나가는 YouTube 요청은 차단 후
명시적 assertion 실패로 처리하며, 통신 차단이나 heading 표시만으로 성공하지 않는다.

실제 외부 SDK 경계는 `smoke/youtube-player.integration.spec.ts`가 소유한다.
공개 영상 `VnqgmOJaMGc`와 실제 `iframe_api`/embed를 사용하고, SDK callback으로
갱신되는 앱의 준비 상태·양수 duration, 명시적 사용자 재생 클릭 뒤 currentTime 증가,
일시정지 뒤 시간 정지를 검증한다. API·인증·수강·진도는 메모리 내 합성 응답으로만
처리하며 실제 계정·학생 활동·생산 기록을 생성하지 않는다. 실패 시 vendor 응답과
console 출처를 artifact에 남긴다. 외부 미가용·embed 거절·권한 정책·console 오류는
실패이며 skip/green 변환이나 권한 완화를 허용하지 않는다. 실제 공급자 장애를
인위적으로 발생시키지 않으며, 오류/retry 주입 검증은 위 fixture 결과와 구분한다.

실행 책임은 학생 영상 SDK/정책·이 fixture 경계를 변경하는 작업의 소유자다.
그 변경의 완료 전에 focused 회귀와 실제 smoke를 모두 실행하고 정확한 SHA·브라우저·
trace·결과를 handoff한다. 현재 실제 smoke는 자동 PR CI/스케줄에 연결되어 있지 않다.
명시적 아래 명령으로 실행하며, 새 workflow·스케줄 연결은 별도 검토 대상이다.
응답 순서/fixture 회귀는 기존 `pr-route-mocks`에 등록된 동일 파일에서 매 PR 실행된다.
실제 smoke의 로컬 PASS는 PR 전체 CI나 생산 배포 검증을 대체하지 않는다.

```powershell
# 검증할 정확한 checkout에서 별도 터미널로 실행
$env:VITE_DEV_PROXY_TARGET = "http://127.0.0.1:9"
pnpm dev --host 127.0.0.1 --port 5174 --strictPort

# 같은 checkout의 테스트 터미널
$env:CI = "true"
$env:E2E_BASE_URL = "http://127.0.0.1:5174"
$env:E2E_LOCAL_BASE_URL = "http://127.0.0.1:5174"
$env:E2E_STRICT = "strict"
$env:E2E_ALLOW_PRODUCTION_WRITES = "0"
$env:E2E_ALLOW_REAL_ALIMTALK = "0"
pnpm exec playwright test e2e/student/video-cdn-service-error.mock.spec.ts --config=playwright.pr-gate.config.ts --project=pr-route-mocks --no-deps --retries=0
pnpm test:e2e:youtube-integration --trace=on --reporter=list
```

실제 CI 응답 순서 case는 Desktop Chrome 프로젝트의 기본 viewport를 describe에서
1366×768로 재정의하고 `serviceWorkers: "block"`을 사용한다. 실제 SDK smoke도
동일한 viewport/service-worker 경계를 사용하고 추가 permissions를 부여하지 않는다.

### 전 메뉴 감사

전 메뉴 감사는 아래 한 spec이 관리자/개발자 desktop, 학생 390px, 선생님 390px
scope를 차례로 실행한다. workflow는 의존성 설치·Chromium 설치·Vite 기동을 한
번만 수행하며 테스트 재시도를 사용하지 않는다.

```powershell
pnpm exec playwright test e2e/stability/all-menu-button-click-audit.spec.ts --project=chromium --reporter=list --retries=0
```

주간 시각 감사도 `e2e/visual/design-system-route-audit.spec.ts` 한 번으로 9개
surface를 직렬 실행한다. 실패 증거는 하나의 artifact에 route별 screenshot,
trace, HTML report로 남는다.

## 새 테스트를 추가할 때

1. 제품 경계에 맞는 디렉터리에 행동 중심 이름으로 추가한다.
2. mock spec은 모든 API 요청을 browser context에서 가로채고 실제 API fallback을
   허용하지 않는다.
3. 저장은 payload와 reload 후 상태를 함께 검증하고, 390px 대상은 overflow와
   핵심 action 표시를 검증한다.
4. 운영 read-only, 폐쇄 proxy route mock, 통제 쓰기 중 정확히 필요한 suite에만 등록한다.
5. 일회성 재현 spec은 결함을 닫은 뒤 유지되는 회귀 계약으로 일반화하거나
   삭제한다. 날짜성 파일, screenshot dump, 실행 보고서를 남기지 않는다.
