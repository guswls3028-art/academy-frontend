# 공개 업데이트 소식

## 목적과 사용자 흐름

`/promo/updates`는 로그인 전후 누구나 볼 수 있는 제품 변경 안내다. 내부
커밋명이나 인프라 용어 대신 실제 사용자가 체감하는 기능, 제공 범위와 실패
동작을 날짜순으로 설명한다.

- 프로모션 사이드 메뉴와 모든 프로모션 페이지의 footer에서 진입한다.
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

업데이트 데이터의 소유 위치는
`src/app_promo/domains/landing/pages/UpdatesPage.tsx`다. 기존 내부
`src/shared/product/patchNotesData.ts`는 과거 운영 메모와 기술 상세를 포함해
공개 페이지의 데이터 원본으로 사용하지 않는다.

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
  src/app_promo/app/PromoRouter.tsx
pnpm exec playwright test e2e/refactor/promo-router.spec.ts
pnpm build
```

검증은 직접 URL 렌더링, desktop/mobile 메뉴와 footer CTA, 모든 내부 링크
대상, 모바일 390px 레이아웃, 접근 가능한 제목·날짜·링크 이름을 포함한다.
Cloudflare production gate는 upload 후 `/promo/updates`의 200 응답, title과
canonical URL을 별도로 확인하며 실패 시 직전 production baseline으로
rollback한다.
