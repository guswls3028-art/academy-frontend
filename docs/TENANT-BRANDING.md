# 테넌트 브랜딩 UI 계약

신규 테넌트의 로그인 화면과 로그인 후 공용 헤더를 같은 브랜드로 완성하기 위한
프런트엔드 정본이다. 도메인·운영 DB·대표 계정까지 포함한 전체 절차는 백엔드
`docs/operations/tenants/custom-domain.md`가 소유한다.

## 완료의 정의

로고 파일을 등록하고 로그인 화면에 표시하는 것만으로 완료 처리하지 않는다.

- 로그인: 데스크톱·모바일에서 로고 배경이 페이지나 브랜드 스테이지와 이어진다.
- 내부 화면: 관리자·선생·학생·학부모 상단바에서 같은 브랜드 계약을 사용한다.
- 테마: 라이트·다크에서 로고가 흰색 또는 검은색 헤더 위에 네모 사진처럼 뜨지 않는다.
- 반응형: 1366px와 390px에서 가로 넘침이 없고, 좁은 화면에서는 제목보다 로고를
  우선해 안전하게 축약한다.
- 기능: 홈 이동, 메뉴, 알림, 프로필과 키보드 포커스 동작을 유지한다.

## 1. 입력과 로고 분류

원본을 실제 크기로 열어 아래 중 하나로 분류한다.

| 유형 | 헤더 처리 |
|---|---|
| 투명 배경 아이콘 | `headerLogoUrl`만 등록하고 공용 헤더 표면을 유지 |
| 단색 불투명 배경 | 이미지 모서리색을 `headerPalette.surface`로 등록 |
| 사진·그라데이션 불투명 배경 | 네 모서리의 대표색을 `surface`, 이미지에서 헤더로 이어질 중간색을 `surfaceSoft`로 등록 |

`logoUrl`은 로그인·큰 브랜드 면용이고 `headerLogoUrl`은 상단바용 1:1 크롭이다.
불투명 원본을 그대로 축소한 파일을 두 필드에 중복 등록하지 않는다. 헤더 파일은
32px 표시에서도 핵심 심벌이 식별되도록 별도로 확인한다.

비밀번호나 계정 ID는 에셋명·코드·문서·스크린샷 파일명에 넣지 않는다.

## 2. 레지스트리 SSOT

테넌트 정의는 `src/shared/tenant/tenants/<code>.ts`에 둔다. 불투명 헤더 에셋은
다음 팔레트를 함께 등록한다.

```ts
branding: {
  logoUrl: "/tenants/<code>/logo.png",
  headerLogoUrl: "/tenants/<code>/icon.png",
  headerPalette: {
    surface: "#이미지-모서리-배경색",
    surfaceSoft: "#헤더로-이어질-중간색",
    foreground: "#표면-위-제목색",
    accent: "#포커스와-브랜드-강조색",
  },
}
```

`getTenantHeaderCssVars()`가 팔레트를 공용 CSS 변수로 변환한다. 역할별 헤더에서
테넌트 코드를 다시 하드코딩하지 않는다.

## 3. 소비 경계

| 화면 | 소유 파일 | 계약 |
|---|---|---|
| 관리자 | `src/app_admin/layout/Header.tsx` | 팔레트 테넌트는 `headerLogoUrl`을 Program 원본보다 우선 |
| 선생 | `src/app_teacher/layout/TeacherTopBar.tsx` | 팔레트와 헤더 전용 에셋을 공용 리본에 적용 |
| 학생 | `src/app_student/layout/StudentTopBar.tsx` | 학생 테마와 무관하게 브랜드 리본 유지 |
| 학부모 | 학생 레이아웃 공유 | 학생과 동일한 계약, 좁은 화면에서는 아이콘 우선 |

세 헤더는 `data-tenant-header-brand`와 아래 CSS 변수를 공통으로 사용한다.

```text
--tenant-header-surface
--tenant-header-surface-soft
--tenant-header-foreground
--tenant-header-accent
```

리본은 `surface`에서 시작해 `surfaceSoft`를 거쳐 투명해진다. 전체 상단바 배경을
테넌트색으로 덮지 않으므로 다른 조작의 라이트·다크 대비는 그대로 유지된다.

## 4. 신규 테넌트 작업 순서

1. `public/tenants/<code>/`에 로그인 로고와 1:1 헤더 에셋을 준비한다.
2. `src/shared/tenant/tenants/<code>.ts`에 호스트·브랜드·헤더 팔레트를 등록한다.
3. `src/auth/themes/<code>.css`에서 로그인 장면을 구성한다.
4. 학생앱 전용 색이 필요하면
   `src/app_student/shared/ui/theme/tenants/<code>.css`를 추가한다.
5. OG·PWA·성적표 등 백엔드 커스텀 도메인 매뉴얼의 나머지 경계를 반영한다.
6. 역할·테마·폭 검증을 통과한 뒤 정식 품질 게이트로 배포한다.

## 5. 검증표

최소 조합은 다음과 같다.

| 역할 | 1366px | 390px | 라이트 | 다크 |
|---|---:|---:|---:|---:|
| 관리자 | 필수 | 필수 | 필수 | 필수 |
| 선생 | 필수 | 필수 | 필수 | 필수 |
| 학생 | 필수 | 필수 | 필수 | 필수 |
| 학부모 | 필수 | 필수 | 필수 | 필수 |

각 조합에서 확인한다.

- `headerLogoUrl`이 선택되고 큰 `logoUrl` 원본이 상단바에 노출되지 않음
- 이미지 표시 크기 32×32px
- 로고 모서리와 리본 시작면 사이에 눈에 띄는 색 경계가 없음
- 제목색이 `foreground`이고 배경 대비가 유지됨
- 문구·아이콘 겹침과 가로 스크롤이 없음
- 390px에서 공간이 부족하면 제목이 말줄임 또는 생략되고 로고는 유지됨
- 홈 이동, 메뉴, 알림, 프로필, 포커스 링이 정상

기본 정적 검증:

```powershell
cd C:\academy\frontend
pnpm typecheck
pnpm exec eslint <변경한 ts/tsx 파일>
pnpm build
git diff --check
```

운영 배포는 `.github/workflows/quality-gate.yml`을 통과해야 한다. 배포 후 실제
테넌트 계정으로 역할별 상단바와 tenant isolation을 다시 확인한다.
