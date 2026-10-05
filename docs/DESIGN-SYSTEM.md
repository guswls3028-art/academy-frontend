# 관리자·교사 디자인 시스템

## 범위와 정본

관리자·교사가 같은 동작과 상태 표현을 사용하는 디자인 시스템이다. 실행 진입점은
`src/index.css` → `src/styles/design-system/index.css`, 공용 React 진입점은
`src/shared/ui/ds/index.ts`다. 도메인 화면은 의미에 맞는 공용 컴포넌트와 토큰을
소비하고, 목록 폭·그리드·반응형 배치는 해당 모듈 CSS가 소유한다.
학생·학부모 테넌트 테마는 [별도 소유 문서](../src/app_student/shared/ui/theme/README.md)를
따른다. 로그인 브랜드는 `src/auth/themes/`와 [테넌트 브랜딩](TENANT-BRANDING.md)이
소유하며 관리자 테마로 대체하지 않는다.

| 계층 | 소유 구현 | 책임 |
|---|---|---|
| 색상 재료·역할 | `colors/scale/`, `colors/role/`, `colors/index.css` | 원색, 의미별 배경·글자·테두리·브랜드, 기존 이름 호환 |
| 치수·글꼴 | `density/`, `typography/` | 간격·크기·반경·글꼴 크기 |
| 표면 | `surface/slots.css` | page/work/primary/meta/KPI/control 표면 역할 |
| 테마 | `colors/themes/index.css` | 12개 테마별 실제 팔레트·레이아웃·그림자·공용 상태 보정 |
| 컴포넌트·상태 | `patterns/`, `ds/`, `components/`, `antd/`, `state/` | 역할 토큰을 사용하는 실제 컨트롤 |

위 경로는 별도 표기가 없으면 `src/styles/design-system/` 기준이다.
기본 색상·치수·글꼴·표면을 먼저 로드하고 **테마를 그 뒤** 로드한다.
동일한 specificity의 `:root` 기본값이 테마의 RGB·모달·다크 그림자를 덮지 않도록
이 순서를 유지한다. 컴포넌트는 테마 뒤에서 역할 토큰을 참조한다.
새 역할은 해당 소유 파일에 추가하고 화면별 복제 토큰이나 무근거 fallback으로 숨기지 않는다.

## 테마 선택과 미리보기

`src/shared/theme/themes.ts`가 키·이름·그룹, `themeRuntime.ts`가 DOM 적용과
브라우저 저장을 소유한다. `/workspace/settings/appearance`와 설정의 테마 영역은
같은 `ThemeGrid` → `ThemeCard`를 사용한다. `ThemeCard`는 공용 `Button`의
hover/focus/pressed/disabled 상태를 재사용하고 `aria-pressed`로 선택을 알린다.
네이티브 Enter/Space로 적용하며 각 테마의 전체 이름을 표시한다.
그리드는 가용 폭에 맞춰 줄바꿈하고 390px에서는 두 열로 배치한다.

미리보기의 `data-theme`는 실제 테마 CSS를 사용한다. 상위 테마에서 이미 계산된
역할 값이 상속되지 않도록 배경·글자·테두리·브랜드의 **기존 역할 선언**을
`:root, .theme-preview`에 함께 적용한다. `colors/preview-theme.css`는
미니어처가 쓰는 이름을 실제 역할 토큰에 연결할 뿐 색상값을 별도로 보관하지 않는다.
미리보기는 장식용이므로 접근성 트리에서 제외하며 선택은 바깥 버튼이 맡는다.

선택 즉시 문서 루트가 바뀌며 `hakwonplus:theme`를 같은 브라우저에서 복원한다.
기존 12개 키와 `ivory-office`/`youtube-studio`/`terminal-neon`의 이관을 유지한다.
저장소가 차단되어도 현재 화면의 적용은 가능하지만 재방문 복원은 보장되지 않는다.
서버 저장·테넌트 설정 변경·API 쓰기는 없으며 계정·권한·학생 데이터 경계도 바꾸지 않는다.
저장 범위와 실패 안전의 상위 계약은 [브라우저 저장](BROWSER-PERSISTENCE.md)이 소유한다.

## 표면과 상태

`Panel`의 `primary` 표면은 `--ui-hero-bg/border`를 통해 강조 표면과 선택 테두리에
연결된다. `PageHeader`의 hero 변형과 DOM/CSS 계약은 서로 다르므로 클래스 이름만
보고 합치지 않는다. 게시판 카드는 `--color-bg-surface`, 작은 글꼴은 `--text-xs`를
참조한다. `EmptyState`는 tone에 따라 로딩·오류·빈 결과의 기본 제목을 구분하고,
명시한 제목과 설명·복구 action은 호출자가 소유한다.

기존의 미사용 `previewThemeVars.ts`, `.theme-scope` 매핑과 로드되지 않던
`surface/{canvas,card,panel,overlay}.css`는 팔레트·표면의 중복 정본이 되므로 제거했다.
실제 소비자는 위 역할/표면 소유자로 연결한다. 저장된 테마 선택과 사용자 데이터의
삭제·변환은 없고 기존 공개 컴포넌트 변형은 유지한다.

## 공용 컨트롤 계약

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

## 회귀 검증

`e2e/admin/design-system-theme.mock.spec.ts`는 실제 설정 화면에서 12개 미리보기와
적용 팔레트를 비교하고, 상위 밝은/어두운 테마에 따라 미리보기 색상이 변하지 않는지,
선택 → 저장 → 새로고침 복원, 기존 키 이관, 1100/1366/390px 라벨·넘침·키보드와
reduced-motion을 확인한다. API는 격리된 route mock이며 운영 쓰기가 없다.
`e2e/suites.mjs`의 PR route-mock 목록에서 항상 실행한다.

```sh
# API proxy가 닫힌 로컬 Vite 서버를 실행한 뒤
E2E_BASE_URL=http://127.0.0.1:5174 pnpm exec playwright test \
  --config=playwright.pr-gate.config.ts --project=pr-route-mocks --no-deps \
  e2e/admin/design-system-theme.mock.spec.ts
```

12개 테마의 공용 컨트롤 대비·상태 검사는 위 theme gate가 소유한다.
공식 배포는 [배포 운영 계약](DEPLOYMENT-OPERATIONS.md)의 동일 artifact 개발 검증과
cleanup0, 운영 승인·버전·자산·영향 화면 확인을 그대로 따른다.
