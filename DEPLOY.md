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

---

## 7. DNS 스펙 (hakwonplus.com)

Cloudflare **Domains → hakwonplus.com → DNS → Records** 에서 아래와 맞추면 됩니다.

### 현재 적용된 레코드 (유지)

| Type | Name | Content | Proxy | 비고 |
|------|------|---------|--------|------|
| A | api | 15.165.147.157 | Proxied (주황) | API 서버 |
| CNAME | cdn | pub-54ae4dcb984d4491b08f6c57023a1621.r2.dev | Proxied | R2 / 미디어 CDN |
| CNAME | (루트) hakwonplus.com | academy-frontend-26b.pages.dev | Proxied | 프론트(Cloudflare Pages) |

### 추가 권장 레코드

**www (프론트와 동일하게)**

| Type | Name | Content | Proxy |
|------|------|---------|--------|
| CNAME | www | academy-frontend-26b.pages.dev | Proxied |

- 추가 후 **Workers & Pages → academy-frontend → Custom domains** 에서 `www.hakwonplus.com` 도메인 추가.
- www 없이 쓰려면 이 레코드만 추가해 두고, 나중에 **Rules → Redirect Rules** 로 `www.hakwonplus.com` → `https://hakwonplus.com` 301 리다이렉트 설정 가능.

**메일 (택 1)**

- **@hakwonplus.com 메일 사용 시:** 사용할 메일 업체(Google Workspace, Naver Works 등)에서 안내한 **MX** 레코드 추가.
- **메일 미사용 / 스푸핑만 방지:** **Email → DNS** 또는 **Security** 에서 SPF, DKIM, DMARC 레코드만 설정 (MX 불필요).

### Nameservers (참고)

- barbara.ns.cloudflare.com  
- thaddeus.ns.cloudflare.com  

### 요약 체크

- [ ] api → 15.165.147.157 (A, Proxied)
- [ ] cdn → R2 CNAME (Proxied)
- [ ] hakwonplus.com → academy-frontend-26b.pages.dev (CNAME, Proxied)
- [ ] www → academy-frontend-26b.pages.dev (CNAME, Proxied) — 권장
- [ ] MX 또는 SPF/DKIM/DMARC — 용도에 따라 설정
