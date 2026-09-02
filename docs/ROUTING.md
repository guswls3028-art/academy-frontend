# 프런트엔드 라우트 규칙

## 공개 URL 계약

최상위 경로는 권한명이 아니라 사용자가 진입하는 제품 화면을 나타낸다.

| 경로 | 화면 | 접근 역할 |
|------|------|-----------|
| `/workspace/*` | 통합 업무 화면 | `owner`, `admin`, `teacher`, `staff` |
| `/workspace/mobile/*` | 모바일 최적화 업무 화면 | `owner`, `admin`, `teacher`, `staff` |
| `/student/*` | 학생·학부모 화면 | `student`, `parent` |
| `/dev/*` | 플랫폼 개발자 콘솔 | 별도 플랫폼 권한 |

`admin`, `teacher` 같은 역할명은 인증·인가에만 사용한다. URL만으로 권한을
표현하거나 추론하지 않는다. 통합 업무와 모바일 업무는 같은 테넌트 데이터와
백엔드 권한 계약을 사용하며 화면 구성만 다르다.

## 호환 경로

- `/admin/*`은 같은 하위 경로를 유지해 `/workspace/*`로 이동한다.
- `/teacher/*`은 같은 하위 경로를 유지해 `/workspace/mobile/*`로 이동한다.
- 리다이렉트는 query, hash, navigation state를 보존한다.
- 새 코드와 새 문서는 호환 경로를 링크로 만들지 않는다.
- Cloudflare는 `/omr-sheet.html`을 같은 query를 유지한 `/omr-sheet` 308로
  정규화할 수 있다. 운영 배포 게이트는 HTTPS redirect를 최대 한 번만
  따르고, 최종 URL이 `hakwonplus.com`의 두 OMR 호환 경로 중 하나인지
  확인한 뒤 정적 페이지의 canonical target과 script 안전성을 검사한다.

기존 설치형 모바일 앱의 identity를 유지하기 위해 teacher manifest의 `id`는
`/teacher`로 보존한다. 실제 `start_url`과 `scope`는 `/workspace/mobile`이다.
`/teacher-manifest.json`, `/teacher-sw.js`, `/teacher-app/*` 같은 자산·백엔드
계약 이름은 브라우저 라우트가 아니므로 이 규칙의 변경 대상이 아니다.
브라우저가 Service Worker를 지원하지 않거나 자동화·보안 정책으로 등록 결과를
제공하지 않으면 모바일 업무 화면은 등록만 건너뛰고 일반 SPA로 계속 동작한다.
이 비지원 경계에서 빈 registration을 업데이트 대상으로 사용해 브라우저 오류를
만들면 안 된다.

## 구현 경계

- canonical 경로와 호환 경로의 단일 기준은
  `src/core/router/workspaceRoutes.ts`이다.
- 런타임은 React/React DOM 19.2.7 이상과 `react-router` 8.3.0 이상을 사용하는
  `BrowserRouter` 기반 선언형 SPA다. DOM 라우팅 API는 v8에서 제거된
  `react-router-dom` 호환 패키지가 아니라 `react-router`에서 import한다.
- 서버 route module, action/loader 서버 실행, RSC entry와 `@react-router/dev`
  는 현재 라우팅 경계에 포함되지 않는다. 이를 도입할 때는 SPA 빌드·Cloudflare
  fallback·CSRF 경계를 다시 설계하고 운영 검증 문서를 함께 갱신한다.
- `app_admin`과 `app_teacher` 디렉터리명은 기존 구현 경계를 나타내는 내부
  이름이다. 공개 URL이나 사용자 역할 계약으로 사용하지 않는다.
- 하위 페이지 링크는 canonical 경로만 생성한다.
- 모바일 자동 전환은 통합 업무 홈에만 적용한다. 명시적인 상세 딥링크는
  모바일에서도 해당 통합 업무 경로를 유지한다.

## 검증

```powershell
node scripts/guard-workspace-route-names.mjs
pnpm exec playwright test e2e/root-routing-contract.spec.ts e2e/pwa-branding-contract.spec.ts
pnpm typecheck
```
