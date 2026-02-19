# 프론트 배포 (요약)

> **패키지 매니저: pnpm 전용** (npm 사용 금지)

**상세**: 루트 `DEPLOY.md`. 대상: **Cloudflare Pages** 단일 호스팅.

---

## 빌드

- **명령**: `pnpm run build` (= `vite build && node scripts/ensure-spa-mode.js`)
- **출력**: `dist/`
- **SPA**: Cloudflare는 루트에 404.html이 없으면 SPA로 동작. `ensure-spa-mode.js`가 `dist/404.html` 제거.

## 환경 변수 (빌드 시)

| 변수 | 필수 | 비고 |
|------|------|------|
| VITE_API_BASE_URL | ✓ | shared/api/axios.ts |
| VITE_APP_VERSION | 선택 | 기본 "dev" |
| VITE_MEDIA_CDN_BASE | 선택 | VideoThumbnail 등 |
| VITE_TENANT_CODE | 선택 | 개발 오버라이드 |

Cloudflare: **Settings → Variables and Secrets**.

## 배포 관련 파일

| 파일 | 역할 |
|------|------|
| `scripts/ensure-spa-mode.js` | dist/404.html 제거 → SPA 모드 유지 |
| `public/_headers` | 캐시 정책 |
| `.env.example` | env 참고 |

## Cloudflare 체크

- Build: `pnpm run build`, Output: `dist`, Root: 비움
- NODE_VERSION=20, VITE_API_BASE_URL 설정
- `packageManager: pnpm@9.15.0` → 빌드 시 pnpm 사용
