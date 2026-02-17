# 프론트 배포 (실제 코드 기준)

**상세**: 저장소 루트 `DEPLOY.md`. 대상: Cloudflare Pages.

---

## 1. 빌드

- **명령**: `pnpm run build` (실제: `vite build && node scripts/ensure-spa-mode.js` — package.json).
- **출력**: `dist/`.
- **SPA 라우팅**: Cloudflare Pages는 **top-level 404.html이 없으면** SPA로 간주. `ensure-spa-mode.js`가 `dist/404.html`을 제거해 SPA 모드 유지.

---

## 2. 환경 변수 (빌드 시점)

코드에서 사용하는 VITE_ 변수:

| 변수 | 사용처 | 필수 | 비고 |
|------|--------|------|------|
| VITE_API_BASE_URL | shared/api/axios.ts | **필수** | API 서버 URL |
| VITE_APP_VERSION | shared/api/axios.ts (헤더) | 선택 | 기본 "dev" |
| VITE_MEDIA_CDN_BASE | features/videos/ui/VideoThumbnail.tsx | 선택 | 기본 "" |
| VITE_TENANT_CODE | shared/tenant/index.ts | 선택 | 개발 오버라이드용 |

Cloudflare Pages: **Settings → Variables and Secrets** 에서 Build 시 적용.

---

## 3. Cloudflare Pages 설정 체크리스트 (코드 기준)

| 항목 | 권장값 | 확인 |
|------|--------|------|
| Build command | `pnpm run build` | ✓ |
| Build output directory | `dist` | ✓ |
| Root directory | (비움) | ✓ |
| NODE_VERSION | `20` | ✓ |
| VITE_API_BASE_URL | `https://api.hakwonplus.com` | ✓ |

선택 변수(필요 시 추가): `VITE_APP_VERSION`, `VITE_MEDIA_CDN_BASE`, `VITE_TENANT_CODE`.

- **Package manager**: `package.json`에 `"packageManager": "pnpm@9.15.0"` 있으면 Cloudflare Build (v3)이 pnpm 사용.
- **Production branch**: `main` (또는 사용 브랜치).
- **Custom domains**: hakwonplus.com, www 등 (DEPLOY.md §7 참고).

---

## 4. 프로젝트 내 배포 관련 파일

| 파일 | 역할 |
|------|------|
| `scripts/ensure-spa-mode.js` | 빌드 후 dist/404.html 제거 → Cloudflare SPA 모드 유지 |
| `public/_headers` | HTML no-cache, /assets/* 장기 캐시 등 |
| `.env.example` | 환경 변수 참고 |

---

## 5. 로컬 프리뷰

- `pnpm run build` → `pnpm run preview`
