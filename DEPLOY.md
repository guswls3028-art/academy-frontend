# 프론트 배포 (Cloudflare Pages)

배포 대상: **Cloudflare Pages** 단일 호스팅.  
Cursor용 요약: `docs_cursor/04-deployment.md`.

---

## 1. 빌드

| 항목 | 값 |
|------|-----|
| 패키지 매니저 | pnpm (`packageManager`: pnpm@9.15.0) |
| 설치 | `pnpm install` |
| 빌드 | `pnpm run build` (= `vite build && node scripts/ensure-spa-mode.js`) |
| 출력 디렉터리 | `dist` |
| Node | 20 (권장) |

**SPA 라우팅**: Cloudflare Pages는 루트에 `404.html`이 없으면 SPA로 동작해 모든 경로를 `index.html`로 서빙합니다. 빌드 스크립트에서 `ensure-spa-mode.js`가 `dist/404.html`을 제거해 이 동작을 유지합니다.

---

## 2. Cloudflare Pages 설정

### Build configuration

- **Build command:** `pnpm run build`
- **Build output directory:** `dist`
- **Root directory:** (비움)
- **Variables (Build):**
  - `NODE_VERSION`: `20`
  - `VITE_API_BASE_URL`: `https://api.hakwonplus.com` (필수)
  - 선택: `VITE_APP_VERSION`, `VITE_MEDIA_CDN_BASE`, `VITE_TENANT_CODE`

### 기타

- **Production branch:** `main`
- **Custom domains:** hakwonplus.com, www 등 (§5 참고)

---

## 3. 환경 변수 (코드 기준)

| 이름 | 사용처 | 필수 |
|------|--------|------|
| VITE_API_BASE_URL | API 베이스 URL | ✓ |
| VITE_APP_VERSION | axios 헤더 등 (기본 "dev") | 선택 |
| VITE_MEDIA_CDN_BASE | 미디어 CDN (썸네일 등) | 선택 |
| VITE_TENANT_CODE | 테넌트 오버라이드 (개발용) | 선택 |

Cloudflare: **Workers & Pages → academy-frontend → Settings → Variables and Secrets** 에서 설정.

---

## 4. 배포 관련 파일 (프로젝트 내)

| 파일 | 역할 |
|------|------|
| `scripts/ensure-spa-mode.js` | 빌드 후 `dist/404.html` 제거 → Cloudflare SPA 모드 유지 |
| `public/_headers` | HTML no-cache, `/assets/*` 장기 캐시 (Cloudflare 적용) |
| `.env.example` | 환경 변수 참고용 |

---

## 5. 로컬 프리뷰

```bash
pnpm install
pnpm run build
pnpm run preview
```

---

## 6. 배포 체크리스트

- [ ] Build command: `pnpm run build`
- [ ] Build output directory: `dist`
- [ ] NODE_VERSION=20
- [ ] VITE_API_BASE_URL (프로덕션 URL)
- [ ] Custom domain 설정 (필요 시)

---

## 7. DNS (hakwonplus.com)

Cloudflare **Domains → hakwonplus.com → DNS** 참고.

| Type | Name | Content | Proxy |
|------|------|---------|--------|
| A | api | 15.165.147.157 | Proxied |
| CNAME | cdn | R2 버킷 CNAME | Proxied |
| CNAME | @ | academy-frontend-26b.pages.dev | Proxied |
| CNAME | www | academy-frontend-26b.pages.dev | Proxied (권장) |

Pages 프로젝트 **Custom domains** 에서 `hakwonplus.com`, `www.hakwonplus.com` 추가.
