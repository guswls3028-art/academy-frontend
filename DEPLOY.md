# 배포 (Cloudflare Pages)

## 빌드 설정

| 항목 | 값 |
|------|-----|
| **패키지 매니저** | pnpm |
| **설치** | `pnpm install` (자동 또는 Install command) |
| **빌드** | `pnpm run build` |
| **출력 디렉터리** | `dist` |
| **Node** | 20 (권장, NODE_VERSION=20) |

## Cloudflare Pages 설정

1. **Build configuration**
   - **Build command:** `pnpm run build`
   - **Build output directory:** `dist`
   - **Root directory:** (비워두기)

2. **Variables and Secrets** (필수/권장)
   - `VITE_API_BASE_URL` — API 서버 URL (예: `https://api.hakwonplus.com`)
   - 필요 시: `VITE_APP_VERSION`, `VITE_MEDIA_CDN_BASE`, `VITE_TENANT_CODE`

3. **Production branch:** `main` (또는 사용 중인 기본 브랜치)

## 로컬 프리뷰

```bash
pnpm run build
pnpm run preview
```

## 환경 변수

- `.env.example` 참고 후 `.env` 또는 `.env.development` 로컬 복사
- 배포 시에는 Cloudflare **Variables and Secrets** 에서 설정 (빌드 시 주입)
