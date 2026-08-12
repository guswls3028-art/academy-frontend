# 계정 자격증명 화면 계약

이 문서는 프론트엔드에서 비밀번호 변경·초기화·계정복구 화면이 선택해야 하는
API와 성공 후 세션 처리를 소유한다. 비밀번호 원문, 토큰, 실제 사용자 식별자는
로그·문서·테스트 산출물에 남기지 않는다.

## 역할별 경로

| 대상 | 사용자 흐름 | 요청 | 성공 후 상태 |
|---|---|---|---|
| 학생·학부모 | 학생 앱 `내 정보 → 비밀번호 변경` | `POST /core/change-password/` + `old_password`, `new_password` | 기존 access·refresh 토큰 폐기 후 새 비밀번호로 재로그인 |
| 대표·관리자·강사·직원 | 관리자 앱 `설정 → 프로필 → 보안 → 비밀번호 변경` | `POST /core/change-password/` + 동일 본문 | 기존 토큰 폐기 후 재로그인 |
| 임시 비밀번호 사용자 | 로그인 직후 강제 변경 모달 | `POST /core/change-password/` + 동일 본문 | `must_change_password` 해제와 기존 토큰 폐기 후 재로그인 |
| 직원 강제 초기화 | 직원관리에서 한 명 선택 → 비밀번호 변경 | `POST /staffs/{id}/change-password/` + `password` | 대상 기존 토큰 폐기, 대상은 다음 로그인에서 비밀번호 변경 필수 |
| 학생·학부모 계정복구 | 로그인 화면 `아이디 찾기` 또는 `비밀번호 찾기` | `POST /auth/account-recovery/dispatch/` | 존재 여부를 노출하지 않는 공통 응답. 임시 비밀번호는 수신 후 로그인할 때 활성화 |

본인 변경은 역할별 프로필 수정 API에 비밀번호 필드를 섞지 않는다. 프로필
이름·전화번호 저장과 비밀번호 변경을 하나의 제출에 순차 실행하면 후행 요청
실패 시 개인정보만 부분 반영될 수 있으므로, 두 작업은 화면과 요청을 분리한다.
백엔드 호환 경로가 남아 있더라도 신규 화면은 전 역할 공통 본인 변경 API만
사용한다.

## 실패와 입력 처리

- 현재 비밀번호, 4자 이상의 새 비밀번호, 새 비밀번호 확인을 모두 검사한다.
- 현재 비밀번호와 같은 값, 확인값 불일치, 중복 제출은 요청 전에 차단한다.
- 서버의 현재 비밀번호 불일치와 알림톡 전송 실패 문구를 화면에 표시한다.
- 알림톡 전송 실패로 서버가 변경을 롤백하면 현재 화면과 세션을 유지해 다시
  시도할 수 있게 한다.
- 성공 시 서버가 `token_version`을 올리므로 이전 토큰으로 사용자 정보를 다시
  조회하지 않고 즉시 로컬 토큰을 제거한다.

## 검증

화면의 버튼 존재만 확인하지 않고 실제 method·path·body와 성공 후 토큰 제거를
검증한다.

```powershell
pnpm exec playwright test e2e/auth/account-password-flows.mock.spec.ts e2e/auth/account-recovery-modal.spec.ts e2e/admin/staff-operations-contract.mock.spec.ts --project=chromium --reporter=list
pnpm typecheck
pnpm guard:legacy-api
pnpm build
```

학생·학부모 권한 경계는 [STUDENT-PARENT-APP-CONTRACT.md](STUDENT-PARENT-APP-CONTRACT.md),
공용 계정복구의 서버 상태 전이는
`backend/docs/domain/account-recovery.md`를 함께 따른다.
