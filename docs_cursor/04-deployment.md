# 프론트 배포 (실제 코드 기준)

**상세**: 저장소 루트 `DEPLOY.md`. 대상: Cloudflare Pages.

---

## 1. 빌드

- **명령**: `pnpm run build` (실제: `vite build` — package.json).
- **출력**: `dist/`.
- **SPA 라우팅**: Cloudflare Pages는 **top-level 404.html이 없으면** SPA로 간주해 모든 경로를 루트로 매칭. 따라서 빌드에서 404.html을 만들지 않음. (copy-404.js는 Netlify 등 다른 호스팅용으로만 보관.)

---

## 2. 환경 변수 (빌드/런타임)

- **VITE_API_BASE_URL**: API 서버 URL (필수). 예: `https://api.hakwonplus.com`.
- **VITE_APP_VERSION**, **VITE_MEDIA_CDN_BASE**, **VITE_TENANT_CODE**: 선택.

Cloudflare Pages: Build 시점에 설정하거나 Variables and Secrets에 정의.

---

## 3. Cloudflare Pages 설정 (DEPLOY.md 기준)

- Build command: `pnpm run build`
- Build output directory: `dist`
- Root directory: (비움)
- Node: 20 권장 (NODE_VERSION=20)
- Custom domains: hakwonplus.com, www.hakwonplus.com 등
- Production branch: main (또는 사용 브랜치)

---

## 4. 프로젝트 내 배포 관련 파일

| 파일 | 역할 |
|------|------|
| `scripts/copy-404.js` | 404.html 생성(현재 빌드에서 미사용. Cloudflare는 404.html 없을 때 SPA 모드) |
| `public/_headers` | HTML no-cache, /assets/* 장기 캐시 등 |
| `.env.example` | 환경 변수 참고 |

---

## 5. 로컬 프리뷰

- `pnpm run build` → `pnpm run preview`
