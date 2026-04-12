# 학생앱 디자인 시스템 (Student App Design System)

## 구조 개요

학생앱(`src/student`) 전용 디자인 시스템으로, 선생앱 및 로그인 페이지와 완전히 분리되어 있습니다.

### 디자인 시스템 구분

- **학생앱**: `src/student/shared/ui` (이 디렉토리)
- **선생앱**: `src/styles/design-system` (별도 관리)
- **로그인**: `src/features/auth/themes` (별도 관리)

### CSS 파일 구조 및 로드 순서

```
StudentLayout.tsx에서 import 순서:
1. tokens.css          → CSS 변수 정의 (typography, shadow, base.css import)
2. tenants/index.css   → 테넌트별 오버라이드 (tchul.css 등)
3. video.css           → 영상 페이지 전용 다크 모드

tokens.css 내부 import 순서:
1. typography.css      → 타이포그래피 토큰
2. shadow.css          → 그림자 토큰
3. base.css            → 기본 컴포넌트 스타일 (.stu-panel, .stu-action-tile 등)
```

### 스코프 분리

모든 학생앱 CSS는 `[data-app="student"]` 스코프를 사용하여 전역 스타일과 충돌을 방지합니다.

- 학생앱: `[data-app="student"]`
- 선생앱: `[data-app="admin"]` (추정)
- 로그인: `[data-app="auth"]` (추정)

### 테넌트별 테마

- `tenants/tchul.css`: 2번(tchul), 9999번 테넌트용
- `tenants/index.css`: 테넌트 CSS 통합 파일

### 영상 페이지 전용 스타일

- `video.css`: 영상 도메인 전용 다크 모드
- `data-video-page="true"` 속성으로 활성화
- 영상 홈, 코스 상세, 세션 상세, 플레이어 모두 포함

## 주요 원칙

1. **스코프 분리**: `[data-app="student"]`로 학생앱 전용 스타일 보장
2. **테넌트 오버라이드**: `[data-student-theme="tchul"]`로 테넌트별 커스터마이징
3. **도메인별 스타일**: `[data-video-page="true"]`로 영상 페이지 전용 스타일
4. **CSS 변수 우선**: 모든 색상/간격은 CSS 변수(`--stu-*`) 사용
5. **단축형 속성 주의**: `background` 단축형은 개별 속성(`background-color`, `background-image`)과 충돌 가능

## 문제 해결 가이드

### 그라데이션이 적용되지 않는 경우
- `background` 단축형 대신 `background-color` + `background-image` 분리 사용
- `!important` 사용 시 단축형이 개별 속성을 리셋하지 않도록 주의

### 스크롤바가 숨겨지지 않는 경우
- 인라인 스타일 `overflow` 제거하고 CSS로만 제어
- `video.css`에서 `overflow-y: auto !important`로 스크롤 기능 유지, 스크롤바만 숨김
