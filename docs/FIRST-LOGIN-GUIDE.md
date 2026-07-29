# 신규 계정 첫 접속 안내

## 사용자 흐름

`/core/me/`의 `first_login_guide_required`가 `true`인 인증 사용자는 허용된 첫
화면 위에서 짧은 계정 안내를 한 번 본다. 대상은 학생, 학부모, 원장, 관리자,
강사, 직원이다.

이 화면은 비밀번호 변경을 강제하는 가입 단계가 아니다.

- 현재 로그인 아이디를 테넌트 내부 접두어 없이 표시한다.
- 비밀번호 원문은 표시하지 않고 변경 위치만 안내한다.
- 프로필과 화면 설정이 같은 내 정보/설정 영역에 있음을 알린다.
- `확인`, 닫기, ESC는 모두 완료 API를 호출한 뒤 안내를 닫는다.
- `내 정보 열기`는 완료 API 성공 후 역할에 맞는 화면으로 이동한다.

역할별 이동 경로:

| 역할 | 경로 |
|---|---|
| `student`, `parent` | `/student/profile` |
| PC `owner`, `admin`, `teacher`, `staff` | `/workspace/settings/profile` |
| 모바일 `owner`, `admin`, `teacher`, `staff` | `/workspace/mobile/settings` |

## 표시 우선순위

`ProtectedRoute`가 다음 순서로 처리한다.

1. 인증, 테넌트, 역할 접근을 검증한다.
2. 기존 `must_change_password=true`이면 보안상 필수 비밀번호 변경 화면만 표시한다.
3. 필수 변경 대상이 아니고 `first_login_guide_required=true`이면 허용 화면과 함께
   권유형 계정 안내를 표시한다.
4. 완료 상태이면 원래 화면만 표시한다.

## 상태와 실패 처리

완료 상태의 정본은 백엔드 `User.first_login_guide_completed_at`이다. 프론트는
`localStorage`나 테넌트별 임시 키로 완료를 추정하지 않는다.

`POST /core/me/first-login-guide/complete/`가 실패하면 안내를 닫지 않고
`안내 확인을 저장하지 못했습니다. 다시 시도해 주세요.`를 표시한다. 성공 응답 후
현재 인증 스냅샷의 상태를 즉시 완료로 바꿔 추가 GET 없이 안내를 제거한다.
다음 세션과 다른 기기는 `/core/me/`가 같은 서버 완료 상태를 다시 읽는다.

백엔드 데이터/API 계약은
`backend/docs/domain/account-first-use.md`가 소유한다.

## 디자인·접근성 계약

- 테넌트 `ui_config.primary_color`를 얇은 강조선, 아이콘, 확인 버튼에만 사용한다.
- 밝은 강조색은 버튼 글자를 어둡게 계산해 대비를 유지한다.
- 라이트/다크 공통 토큰을 사용하며 학생 다크 테마도 별도로 감지한다.
- 모바일에서는 하단 시트에 가까운 단일 카드로 표시하고 safe-area를 보존한다.
- `role="dialog"`, 제목/설명 연결, 최초 포커스, Tab 순환, ESC 닫기를 제공한다.
- `prefers-reduced-motion`에서는 진입 애니메이션을 사용하지 않는다.

## 검증

```powershell
pnpm typecheck
pnpm exec eslint src/auth/components/FirstLoginGuideModal.tsx src/core/router/ProtectedRoute.tsx src/auth/context/AuthContext.tsx e2e/auth/first-login-guide.mock.spec.ts
$env:E2E_BASE_URL = "http://127.0.0.1:5174"
pnpm exec playwright test e2e/auth/first-login-guide.mock.spec.ts --project=chromium --reporter=list
pnpm build
```

Playwright 실행 전 같은 작업트리에서
`pnpm exec vite --host 127.0.0.1 --port 5174 --strictPort`로 로컬 프론트를
기동한다. 이 route-mock 스펙은 운영 배포본을 로컬 후보로 오인하지 않도록
localhost 이외의 URL에서는 건너뛴다.

수동 시각 검증은 1366px PC와 390px 모바일에서 학생·학부모·선생 역할,
라이트·다크 테마를 확인한다.
