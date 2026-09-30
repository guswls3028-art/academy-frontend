# 학생앱 디자인 시스템 (Student App Design System)

학생·학부모 앱(`/student/*`) 전용 디자인 토큰과 테넌트 테마의 정본이다. 관리자·선생
앱(`src/styles/design-system`)과 로그인(`src/auth/themes`)과는 분리되어 있다. 화면
계약은 [STUDENT-PARENT-APP-CONTRACT](../../../../../docs/STUDENT-PARENT-APP-CONTRACT.md),
로고·상단바 팔레트는 [TENANT-BRANDING](../../../../../docs/TENANT-BRANDING.md)이 소유한다.

## 구조와 로드 순서

`StudentLayout.tsx`가 아래 순서로 import한다.

1. `tokens.css` — 기본 토큰(`--stu-*`). 내부에서 `typography.css`, `shadow.css`,
   `../css/base.css`(공용 컴포넌트 `.stu-panel`, `.stu-btn` 등)를 불러온다.
2. `tenants/index.css` — `brand.css`(공통 브랜드 규칙) → 테넌트 토큰 파일 순서.
3. `dark.css` — 다크 모드 표면·텍스트 토큰. 테넌트 이후에 로드되어 표면을 덮는다.
4. `video.css` — `data-video-page="true"`인 영상 화면 전용 다크 스타일.

모든 규칙은 `[data-app="student"]` 루트 안에서만 적용된다. 루트 속성은 다음과 같다.

| 속성 | 값 | 결정 위치 |
|---|---|---|
| `data-student-tenant` | 요청 테넌트 코드 | `getTenantCodeForApiRequest()` |
| `data-student-theme` | 테마 이름 | `StudentLayout.tsx`의 `STUDENT_THEME_BY_TENANT` |
| `data-student-dark` | `"true"` 또는 없음 | `StudentThemeContext` (라이트·다크·시스템, 브라우저 저장) |

등록되지 않은 테넌트는 `data-student-theme`가 없고 `tokens.css` 기본 테마를 쓴다.
`9999`와 `/login/common` 로컬 경로는 `common` 테마를 쓴다.

## 테넌트 테마 계약

`tenants/brand.css`가 모든 테넌트에 같은 선택자와 구조를 적용하고, 테넌트 파일
`tenants/{theme}.css`는 **토큰만** 정의한다. 테넌트 파일에 선택자를 복제하지 않는다.
브랜드 고유 장식이 꼭 필요하면(예: movementhui 상단 빛 번짐) 그 테넌트 파일 끝에
짧게 추가하고 이유를 주석으로 남긴다.

| 토큰 | 용도 | 대비 기준 |
|---|---|---|
| `--stu-primary` | 링크·활성 탭·강조 글자·primary 면 | 라이트: 흰 면 4.5:1 이상. 다크 블록에서는 밝은 톤으로 재정의해 다크 서페이스 4.5:1 이상 |
| `--stu-primary-contrast` | primary 면 위 글자 | 라이트 `#fff`, 다크는 `brand.css`가 짙은 잉크(`#0b1220`)로 바꾼다 |
| `--stu-gradient` | CTA·primary 버튼·아바타처럼 **흰 글자**를 올리는 배경 | 0~70% 구간 흰 글자 4.5:1 이상, 끝점 3:1 이상 |
| `--stu-on-gradient` | `--stu-gradient` 위 글자 | 테마 적용 시 `#fff` |
| `--stu-brand-1/2/3` | 앱 배경·상단바·탭바·패널에 옅게 까는 장식 색 | 장식 전용(글자 배경 아님). 원색 액센트는 여기에 둔다 |
| `--stu-icon-1/2` | 콘텐츠 아이콘 그라데이션(`#stu-icon-gradient`) 정지점 | 라이트: 흰 면 3:1 이상, 다크 블록: 다크 서페이스 3:1 이상 |
| `--stu-icon-paint` | 아이콘 칠 (기본 `url(#stu-icon-gradient)`) | 단색 테마는 `var(--stu-primary)` |
| `--stu-tab-indicator` | 하단 탭 활성 막대 | 기본 `--stu-gradient` |
| `--stu-wash-app/chrome/surface` | 배경 장식 레이어 | 장식 없는 테마는 `none` (godmin 전체, hakwonplus 패널) |
| `--stu-success/warn/danger` | 배지·막대 등 **채움** 색 | — |
| `--stu-success-text/warn-text/danger-text` | 상태 **글자** 색 | 라이트 흰 면 4.5:1 이상. 다크는 `dark.css`가 밝은 값으로 바꾼다 |

규칙 요약:

- 상태 글자는 반드시 `*-text` 토큰을 쓴다. 채움 색(`--stu-success` 등)을 글자에 쓰지 않는다.
- 빨강 채움 배지 글자는 `#fff`로 고정한다(`--stu-primary-contrast`는 primary 면 전용).
- 앱 상단바는 `.student-layout__header`로만 지정한다. 페이지 제목·달력 머리글 같은
  페이지 안 `<header>`에는 테넌트 배경을 칠하지 않는다.
- 하단 탭 아이콘은 그라데이션을 쓰지 않고 상태색(비활성 muted, 활성 primary)을 따른다.
- 포커스는 `--stu-focus-ring`(기본 primary) 2px 실선과 2px 간격이다. 모양(radius)을 바꾸지 않는다.
- 다크 블록(`[data-app="student"][data-student-dark="true"][data-student-theme="…"]`)은
  `--stu-primary`, `--stu-gradient`, `--stu-icon-1/2`, 필요 시 `--stu-tab-indicator`를 함께 재정의한다.

## 테넌트 추가

1. `tenants/{theme}.css`를 기존 파일을 복사해 만들고 토큰 값만 바꾼다.
2. `tenants/index.css`에 `@import "./{theme}.css";`를 `brand.css` 뒤에 추가한다.
3. `StudentLayout.tsx`의 `STUDENT_THEME_BY_TENANT`에 테넌트 코드 → 테마를 추가한다.
4. 로고·타이틀은 `shared/tenant/studentTenantBranding.ts`, 헤더 팔레트는 TENANT-BRANDING 절차를 따른다.
5. 위 표의 대비 기준을 계산으로 확인하고, 라이트·다크 × 390px·1366px에서 홈·일정·시험·
   성적·영상·공지·알림·커뮤니티·클리닉·내 정보·설정·제출·출결·자료함을 화면으로 확인한다.

## 영상 페이지

`video.css`는 영상 도메인 전용 다크 스타일이다. `data-video-page="true"`로 활성화되며
영상 홈, 코스 상세, 세션 상세, 플레이어를 포함한다.

## 문제 해결

- 그라데이션이 적용되지 않으면 `background` 단축형과 개별 속성(`background-color`,
  `background-image`)의 `!important` 충돌을 확인한다.
- 스크롤바는 인라인 `overflow` 대신 CSS로만 제어한다. `video.css`는 스크롤 기능을
  유지한 채 스크롤바만 숨긴다.
