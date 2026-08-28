# 프로모션 경험 계약

## 목적과 진입 경로

`/promo`는 학원플러스가 무엇을 관리하는지 처음 보는 원장·선생님에게 설명하는
공개 진입 화면이다. 브랜드명은 `학원플러스`를 정본으로 사용하고 핵심 문장은
`출결·성적·복습·학부모 안내까지, 학원의 모든 흐름을 하나로.`로 유지한다.

상단 메뉴는 사용자의 탐색 목적에 맞춰 `기능`, `활용 사례`, `요금`, `가이드`,
`업데이트`, `문의` 순으로 제공한다. 상세 기능인 영상, 매치업·PPT, 채점 보조는
`기능`의 활성 경로로 취급하고, 데모 요청은 `문의`의 활성 경로로 취급한다.

## 첫 화면과 증거

첫 화면은 기능 목록보다 다음 세 가지를 먼저 보여준다.

1. 출결·성적·복습·안내가 이어지는 운영 결과
2. 관리자 PC와 학생 390px 모바일의 실제 제품 화면
3. `실제 화면으로 확인` 데모 진입점

프로모션에 쓰는 실제 제품 캡처는 프로덕션 개인정보를 사용하지 않는다. 영속
개발환경의 `qa-ymath-realuse-*` 격리 테넌트에 합성 학생·강의·차시·출결·시험
데이터를 생성하고, 실제 로그인과 API를 거친 UI만 캡처한다. 화면에는
`격리 개발환경 · 합성 데이터`라고 명시한다. 다른 테넌트는 필드와 화면 구조를
확인하는 읽기 전용 참고만 허용하며 이름·연락처·성적 등 식별 가능한 값을
프로모션 자산에 복사하지 않는다.

정본 캡처 자산은 다음과 같다.

- `public/promo/admin-attendance-realuse-20260828.png`: 관리자 출결 운영
- `public/promo/admin-operations-realuse-20260828.png`: 관리자 오늘 업무
- `public/promo/student-operations-realuse-20260828.png`: 학생 모바일 일정

## 캡처 재현과 정리

영속 개발환경의 격리 시나리오를 준비한 뒤, SSM의 전용 QA 비밀번호를 출력하지
않고 환경변수로만 전달한다. 캡처 스크립트는 loopback 프론트엔드와
`qa-ymath-realuse-*` 테넌트만 허용한다.

합성 운영 데이터는 백엔드의 `setup_ymath_realuse_scenario` 관리 명령으로
생성한다. 생성 결과에서 반환한 테넌트·강의·차시 ID만 캡처 환경변수에 사용한다.

```powershell
$env:PROMO_CAPTURE_BASE_URL = "http://127.0.0.1:5174"
$env:PROMO_CAPTURE_TENANT = "qa-ymath-realuse-<purpose>"
$env:PROMO_CAPTURE_PASSWORD = "<secret-store value>"
$env:PROMO_CAPTURE_LECTURE_ID = "<isolated lecture id>"
$env:PROMO_CAPTURE_SESSION_ID = "<isolated session id>"
pnpm capture:promo-realuse
```

캡처가 끝나면 같은 백엔드 관리 명령의 `--destroy` 경로로 정확한 QA 테넌트를
삭제하고 테넌트와 사용자가 모두 0건 남았는지 읽어 확인한다. 프로덕션 데이터,
R2 객체, 큐 또는 자격 증명을 복제하지 않는다.

## 반응형·접근성 계약

- 1160px 이상은 카피와 제품 증거를 나란히 배치한다.
- 1160px 미만은 카피, 제품 증거, 사용 근거, 기능별 화면 순으로 쌓는다.
- 390px에서는 관리자 화면 위에 학생 모바일 화면을 겹쳐 관계를 유지하되 가로
  스크롤이 없어야 한다.
- 관리자와 학생 캡처는 각각 의미 있는 대체 텍스트를 제공한다.
- `prefers-reduced-motion`에서는 장식 동작을 멈춘다.
- 로딩 중에는 프로모션 레이아웃의 공용 대기 화면을 사용한다. 이미지 로드 실패는
  `PromoEvidenceImage`의 실패 안전 UI로 대체하며 빈 프레임만 남기지 않는다.

## 검증

변경 시 최소한 다음을 확인한다.

```powershell
pnpm typecheck
pnpm lint
pnpm exec playwright test e2e/promo-business-readiness.spec.ts e2e/promo-navigation.spec.ts --project=chromium --reporter=list
pnpm build
```

1366px 데스크톱과 390px 모바일에서 `/promo`를 캡처해 첫 화면의 핵심 문장,
관리자·학생 제품 화면, CTA, 가로 넘침, 기능별 화면 순서를 시각 확인한다.
