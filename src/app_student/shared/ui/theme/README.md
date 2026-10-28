# 학생앱 디자인 연결과 테넌트 테마

학생·학부모 앱은 [공통 디자인 시스템](../../../../../docs/DESIGN-SYSTEM.md)의
기초 값을 사용한다. 이 디렉터리는 학생 역할의 의미 연결과 테넌트별 브랜드를
소유한다. 화면 계약은 [학생·학부모 앱](../../../../../docs/STUDENT-PARENT-APP-CONTRACT.md),
로고·상단바는 [테넌트 브랜딩](../../../../../docs/TENANT-BRANDING.md)이 소유한다.

## 정본과 로드 순서

`StudentLayout.tsx`는 `tokens.css` → `tenants/index.css` → `dark.css` →
`video.css` 순서로 로드한다. `tokens.css` 내부에서 `typography.css`,
`shadow.css`, `../css/base.css`를 불러온다. 물리적 간격·반경·글자·모션·그림자는
`src/styles/design-system/foundation.css`에 한 번만 정의하고 `--stu-*`가 연결한다.
기존 학생 간격은 2px 단위이므로 `--stu-space-4`는 공통 8px에 연결한다.
숫자가 같다고 교사 간격으로 치환하지 않는다.

기본 토큰은 `[data-app="student"]`와 문서의 `html[data-student-app="true"]`에만
적용한다. 문서 범위는 body·포털의 글꼴과 기본 표면을 공급한다.
학생 화면을 떠나면 속성을 해제하여 교사·관리자 화면을 덮지 않는다.
미사용 `palette.css`, tokens 안의 중복 다크 정의, OS 미디어쿼리 기반의 독립
그림자는 제거했다. 사용자·테넌트 데이터와 브라우저의 학생 모드 선택은 유지한다.

| 속성 | 결정 위치·의미 |
|---|---|
| `data-student-tenant` | 요청 테넌트 코드, `getTenantCodeForApiRequest()` |
| `data-student-theme` | `StudentLayout.tsx`의 `STUDENT_THEME_BY_TENANT` |
| `data-student-dark` | `StudentThemeContext`의 라이트·다크·시스템 결과; app과 문서에 동기화 |
| `data-video-page` | 영상 전용 화면 배치·표면 |

등록되지 않은 테넌트는 기본 학생 표시를 쓰지만 API 테넌트를 대체하지 않는다.
`9999`와 `/login/common`은 기존 common 표시를 유지한다. 교사의 개인 테마·강조색은
학생 팔레트에 섞이지 않는다. 학생 다크 표면·텍스트·그림자는 `dark.css`가
유일하게 소유하고 테넌트 브랜드의 다크 강조색은 해당 테넌트 파일이 소유한다.

## 브랜드와 표면

`tenants/brand.css`는 공통 선택자·상태 규칙, `tenants/{theme}.css`는 브랜드 값을
소유한다. 로고·주요 색은 유지하되 일반 화면의 배경 무늬·광택·겹친 그림자를
걷어낸다. 헤더·탭·카드는 차분한 면, 구분선, 여백으로 구획한다.
기본 primary 버튼·아이콘은 단색 강조를 사용한다. 기존 도메인이 소비하는
`--stu-gradient`는 호환을 유지하며 영상·특수 브랜드 표현은 별도 범위에 둔다.

- `--stu-primary`: 링크·활성 탭·강조 면. 밝은 표면과 어두운 표면에서 각각
  읽히는 대비를 유지한다. 면 위 글자는 `--stu-primary-contrast`를 쓴다.
- Primary hover도 `--stu-primary-hover` 단색과 같은 대비 글자를 사용한다.
  브랜드 그라데이션이나 밝기 필터로 돌아가지 않으며, 비활성 버튼은 hover에 반응하지 않는다.
  common·tchul의 다크 hover는 짙은 글자와 4.5:1 이상 대비를 유지한다.
- `--stu-gradient` 위 글자는 `--stu-on-gradient`를 쓴다. 기존 그라데이션 면은
  흰 글자 대비를 유지한다.
- 상태 글자는 `--stu-success-text/warn-text/danger-text`를 쓴다. 채움 색과
  글자 색을 혼용하지 않는다. 빨강 채움 배지의 글자는 흰색을 유지한다.
- 하단 탭은 현재 위치를 색·굵기·인디케이터로 함께 알린다. 기존 홈·영상·일정·알림·
  커뮤니티 순서와 이동 경로를 유지한다.
- 포커스는 `--stu-focus-ring`의 2px 실선과 2px 간격을 유지한다.
  모션은 공통 토큰을 사용하며 reduced-motion을 존중한다.
- 앱 헤더는 `.student-layout__header`만 대상으로 한다. 페이지 내부 header를
  브랜드 배경으로 덮지 않는다.

## 추가·수정과 확인

새 테넌트는 토큰 파일 → `tenants/index.css` import → `STUDENT_THEME_BY_TENANT` →
브랜딩 정본 순서로 연결한다. 기본 화면에 복제 레이아웃 선택자를 추가하지 않는다.
라이트·다크의 글자·상태·아이콘 대비를 확인하고 390/1366px에서 홈·일정·시험·성적·
공지·클리닉·내 정보와 영향 화면을 직접 확인한다.

`e2e/student/design-system-isolation.mock.spec.ts`는 교사 테마와의 독립성,
기존 메뉴, 이동·reload와 좁은 화면을 격리 mock으로 검증한다. 업무 저장·소비자
화면과 오류·재시도는 해당 도메인의 기존 회귀 gate를 유지한다.
`assignment-media-multiupload.mock.spec.ts`는 실제 숙제 제출 버튼에 등록된 9개 브랜드
토큰을 적용해 390/1366px·라이트/다크의 기본·hover 대비, 비활성 제출 차단과
정상 제출·reload 보존을 검증한다. 표시 토큰 검사 중 API 테넌트는 바꾸지 않는다.
`video.css`의 영상 홈·코스·차시·플레이어 범위와 실제 재생 검증도 유지한다.
