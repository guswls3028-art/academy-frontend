# 제품 업데이트 소식

## 목적과 사용자 흐름

`/promo/updates`는 로그인 전후 누구나 볼 수 있는 제품 변경 안내다. 내부
커밋명이나 인프라 용어 대신 실제 사용자가 체감하는 기능, 제공 범위와 실패
동작을 날짜순으로 설명한다.

- 프로모션 사이드 메뉴와 모든 프로모션 페이지의 footer에서 진입한다.
- 통합 업무와 선생님 앱에서는 알림 종 옆 **업데이트** 버튼으로 현재 작업 위에서
  패치노트를 연다. 최신 변경 상세를 처음부터 보여 주며 이전 날짜는 눌러 펼친다.
  600px 이하에서는 문서 아이콘과 접근성 이름으로 표시한다. 닫기 또는 Esc로 돌아간다.
- 기존 `/workspace/developer`와 `/workspace/mobile/developer` 주소도 해당 역할의
  업무 화면에서 같은 내용을 표시한다. 패치노트의 외부 이동을 없애 진행 중 업무와
  테넌트 세션을 보존한다. 버그 제보, 피드백 및 가이드북은 기존 경로를 사용한다.
- 관리자 알림 박스와 선생님 알림 센터의 목록·건수·실패 상태에는 운영 업무만 반영한다.
  새 버전은 **업데이트** 버튼의 점과 접근성 이름으로 표시한다. 기존 학원·사용자별
  로컬 키에서 버전 읽음 상태를 이어받으며, 패치노트 열기 후 새로고침에도 유지한다.
  패치노트는 이 산출물에 포함된 데이터로 즉시 표시하며 목록 요청이나 서버 쓰기가 없다.
- 최신 항목 CTA는 같은 페이지의 최신 업데이트로 이동한다.
- 전체 기능 CTA는 `/promo/features`, 문의 CTA는 `/promo/contact`로 이동한다.
- 모바일에서는 CTA를 한 열로 표시하고 타임라인 카드의 긴 한국어 문장을
  줄바꿈한다.
- 키보드 초점은 링크의 고대비 outline으로 표시하며 `prefers-reduced-motion`
  사용자는 hover 이동 애니메이션을 적용하지 않는다.

## 콘텐츠와 공개 범위

현재 운영에서 사용할 수 있거나 이번 릴리스의 운영 게이트를 통과한 기능만
목록에 올린다. 실험 플래그가 꺼진 기능, 내부 관측 기능, 아직 배포되지 않은
후보는 공개 완료 기능처럼 쓰지 않는다. 단계적 제공 기능은 제목이나 설명에
Beta 또는 제공 범위를 표시한다.

업데이트 데이터의 단일 소유 위치는
`src/shared/product/productUpdates.ts`다. 공개 페이지와 인증 화면의 패치노트는
같은 목록과 최신 항목을 읽는다. 기존 내부
`src/shared/product/patchNotesData.ts`는 과거 운영 메모와 기술 상세를 포함해
공개 페이지의 데이터 원본으로 사용하지 않는다.

## 발행 운영

정기 발행 시각은 **매주 화요일 오전 9시(Asia/Seoul)**다. 직전 발행 이후
production에 실제 반영된 사용자 체감 변경만 감사해 항목을 추가한다. 배포되지 않은
후보, 내부 리팩터링만 있는 변경, 확인되지 않은 홍보 문구는 올리지 않는다. 변경이
없으면 빈 패치노트를 발행하지 않는다. 긴급한 사용성 개선은 화요일 전에도 별도
항목으로 발행할 수 있다.

각 항목은 안정적인 `id`, 날짜, 제목, 사용자 언어 요약, 대상 역할, 제공 범위와
`new|improve|fix` 하이라이트를 가진다. 새 항목은 배열 첫 위치에 추가하고
`LATEST_PRODUCT_UPDATE`가 별도 복사 없이 같은 항목을 가리키게 한다. 발행 변경은
일반 frontend 품질 게이트·PR·production 배포와 `/promo/updates` readback을 통과한
뒤 완료로 본다.

## 라우팅과 검색 노출

- canonical route: `/promo/updates`
- title/description: `src/app_promo/domains/landing/promoMeta.ts`
- sitemap: `public/sitemap.xml`
- Cloudflare edge allowlist and dynamic sitemap:
  `functions/[[path]].ts`
- 허용 테넌트와 fallback은 기존 `PromoGuard` 계약을 그대로 따른다.

## 검증

```powershell
pnpm typecheck
pnpm exec eslint `
  src/app_promo/domains/landing/pages/UpdatesPage.tsx `
  src/shared/product/productUpdates.ts `
  src/shared/product/useProductUpdateAwareness.ts `
  src/app_promo/app/PromoRouter.tsx
pnpm exec playwright test e2e/refactor/promo-router.spec.ts
pnpm build
```

검증은 직접 URL 렌더링, desktop/mobile 메뉴와 footer CTA, 모든 내부 링크
대상, 모바일 390px 레이아웃, 접근 가능한 제목·날짜·링크 이름을 포함한다.
인증 화면은 `e2e/teacher/product-update-guide.mock.spec.ts`에서 1366px·390px의
업데이트 열기, 변경 상세와 이전 패치노트, Esc 후 초점 복귀, 읽음 유지,
알림 건수와 실패 재시도, 기존 주소의 직접 진입을 확인한다.
Cloudflare production gate는 upload 후 `/promo/updates`의 200 응답, title과
canonical URL을 별도로 확인하며 실패 시 직전 production baseline으로
rollback한다.
