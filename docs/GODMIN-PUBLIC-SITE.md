# 신과함께 공개 홈페이지

## 목적과 사용자 흐름

`godmin.kr`의 공개 첫 화면은 통합과학 강사 신민 선생님의 수업 철학과 학습
관리 방식을 학생·학부모에게 설명하고, 기존 수강생을 신과함께 학습
플랫폼으로 연결한다. 비로그인 사용자는 `/`에서 `/landing`으로 이동하며,
상단·히어로·마지막 CTA의 로그인 링크는 모두 `/login/godmin`을 사용한다.

전용 페이지는 `src/landing/pages/GodminLandingPage.tsx`가 소유한다. 다른
테넌트의 설정 기반 공개 랜딩은 기존 `PublicLandingPage`를 그대로 사용한다.
godmin 전용 화면은 공개 랜딩 설정 API의 게시 여부와 무관하게 렌더링되어,
설정 미게시 상태에서도 홈페이지가 로그인 화면으로 되돌아가지 않는다.

## 정보 구조와 표현 계약

페이지는 다음 순서를 유지한다.

1. 통합과학 강의 경력과 대치동 현장 강의를 요약한 히어로
2. 물리·화학·생명·지구과학을 잇는 통합과학 지도
3. 이해 → 적용 → 복습의 학습 루프
4. 교재 연구와 학생 질문을 잇는 연구실 소개
5. 신민 선생님 프로필과 공개 근거 링크
6. 수강생·학부모 로그인 CTA

브랜드 색은 짙은 잉크 그린, 민트, 옅은 프로스트, 포인트 코럴을 사용한다.
인물 사진 주위의 궤도와 네 과학 영역 라벨이 전용 시각 서명이다. 장식은
콘텐츠 판독과 CTA보다 앞서지 않으며 `prefers-reduced-motion: reduce`에서는
모든 애니메이션을 사실상 제거한다. 390px에서는 주요 메뉴를 숨기되 브랜드,
로그인, 본문, CTA를 유지하고 가로 스크롤을 만들지 않는다.

## 콘텐츠와 사진 출처

공개 프로필 문구는 아래 공개 자료에서 교차 확인한 범위만 사용한다.

- MBC `구해줘! 홈즈` 관련 기사: 13년 차 통합과학 강사, 대치동 연구실의
  교재 연구와 학생 질문 공간
- 대치명인 강좌 안내: 대성마이맥·강남대성·두각 출강, 주차별 자료와
  연구실 클리닉 중심의 수업 구성
- 르무통 인터뷰: 학생과 수업을 대하는 강사 소개 및 공개 프로필 사진

페이지의 공개 근거 링크는 새 탭에서 열고 `rel="noreferrer"`를 사용한다.
프로필 사진은 `public/tenants/godmin/landing-portrait.webp`가 소유하며 사진
바로 아래에 르무통 인터뷰 출처 링크를 표시한다. 운영자가 승인된 새 사진으로
교체할 때는 같은 파일 경로와 대체 텍스트를 유지해 레이아웃·접근성 계약을
보존한다.

## 검색·공유 메타데이터

초기 HTML, Cloudflare Functions 호스트 메타, 테넌트 레지스트리와 SPA
페이지 메타는 아래 값을 같은 의미로 유지한다.

- 제목: `신민T 통합과학 | 신과함께`
- 설명: 13년 차 통합과학 강사 신민T의 수업 철학, 학습 관리와 수강생·학부모
  전용 플랫폼
- 대표 이미지: `/tenants/godmin/og-image.png`

SPA 진입 전에도 호스트별 제목·설명·파비콘·OG 값이 노출되고, 페이지가
마운트되면 현재 URL을 `og:url`로 반영한다.

## 실패 안전과 검증

- godmin 전용 페이지는 공개 랜딩 설정 API를 호출하지 않는다.
- 외부 프로필 링크나 Instagram이 실패해도 본문과 로그인 경로는 유지된다.
- 인물 사진에는 설명 가능한 대체 텍스트가 있고, 키보드 포커스는 모든 링크에
  보이는 외곽선을 제공한다.
- 로그인·약관·개인정보처리방침은 기존 제품 라우트를 재사용한다.

로컬 검증은 production build/preview를 우선 사용한다.

```powershell
pnpm typecheck
pnpm lint
pnpm build
$env:E2E_LANDING_BASE_URL = "http://127.0.0.1:4174"
pnpm exec playwright test e2e/godmin-landing.mock.spec.ts --project=chromium --workers=1 --retries=0
pnpm exec playwright test e2e/pwa-branding-contract.spec.ts e2e/root-routing-contract.spec.ts --project=chromium --workers=1 --retries=0
```
