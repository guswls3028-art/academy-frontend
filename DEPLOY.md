# 프론트 배포 (Cloudflare Pages)

## 1. 빌드 설정

| 항목 | 값 |
|------|-----|
| 패키지 매니저 | pnpm |
| 설치 | `pnpm install` |
| 빌드 | `pnpm run build` |
| 출력 디렉터리 | `dist` |
| Node | 20 (권장) |

빌드 시 자동으로 `dist/index.html` → `dist/404.html` 복사되어, SPA 라우트 직접 접근 시에도 정상 동작합니다.

---

## 2. Cloudflare Pages 대시보드 설정

### Build configuration

- **Build command:** `pnpm run build`
- **Build output directory:** `dist`
- **Root directory:** (비워두기)
- **Environment variables (Build):**
  - `NODE_VERSION`: `20`
  - `VITE_API_BASE_URL`: `https://api.hakwonplus.com` (필수)
  - 필요 시: `VITE_APP_VERSION`, `VITE_MEDIA_CDN_BASE`, `VITE_TENANT_CODE`

### Custom domains

- **Production:** `hakwonplus.com` (이미 CNAME → Pages인 경우 Pages에서 도메인 추가)
- **www:** `www.hakwonplus.com` → 동일 프로젝트에 추가 후, DNS에 CNAME `www` → `academy-frontend-xxx.pages.dev` 또는 루트와 동일하게 설정

### Production branch

- `main` (또는 사용 중인 기본 브랜치)

---

## 3. 환경 변수 (프로덕션)

Cloudflare **Workers & Pages → academy-frontend → Settings → Variables and Secrets**에서 설정.

| 이름 | 설명 | 예시 |
|------|------|------|
| VITE_API_BASE_URL | API 서버 URL (필수) | `https://api.hakwonplus.com` |
| VITE_APP_VERSION | 앱 버전 (선택) | `1.0.0` |
| VITE_MEDIA_CDN_BASE | 미디어 CDN URL (선택) | `https://cdn.hakwonplus.com` |
| VITE_TENANT_CODE | 테넌트 코드 오버라이드 (선택) | |

---

## 4. 프로젝트 내 배포 관련 파일

| 파일 | 역할 |
|------|------|
| `scripts/copy-404.js` | 빌드 후 `dist/404.html` 생성 (SPA 폴백) |
| `public/_headers` | 빌드 결과에 포함 — HTML은 no-cache, `/assets/*` 장기 캐시 |
| `.env.example` | 로컬/배포 시 참고용 환경 변수 목록 |

---

## 5. 로컬 프리뷰

```bash
pnpm install
pnpm run build
pnpm run preview
```

---

## 6. 체크리스트 (배포 전)

- [ ] Build command: `pnpm run build`
- [ ] Build output directory: `dist`
- [ ] NODE_VERSION=20
- [ ] VITE_API_BASE_URL 설정 (프로덕션 API URL)
- [ ] Custom domain: `hakwonplus.com` (및 필요 시 `www.hakwonplus.com`)
- [ ] DNS: 루트 CNAME → `academy-frontend-xxx.pages.dev` (이미 적용된 경우 생략)
