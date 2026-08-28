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
└── suites.mjs   PR·release·통제 쓰기 suite 단일 목록
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
| `pnpm test:e2e:release` | 수동 유지보수 release suite | read-only/mock만, `playwright.release.config.ts` |
| `pnpm test:e2e:controlled-writes` | 통제 쓰기 canary | 명시적 workflow opt-in, 재시도 0 |
| `pnpm test:e2e:bundle-smoke` | 빌드 산출물 부팅 | 로컬 preview, strict browser |
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
4. PR/release/통제 쓰기 중 정확히 필요한 suite에만 등록한다.
5. 일회성 재현 spec은 결함을 닫은 뒤 유지되는 회귀 계약으로 일반화하거나
   삭제한다. 날짜성 파일, screenshot dump, 실행 보고서를 남기지 않는다.
