# 알림톡 발송 기록 화면

## 목적과 진입점

관리자 앱의 `/workspace/message/log`는 현재 테넌트의 알림톡 처리 이력을 읽는
운영 화면이다. 발송·재시도·재큐잉·공급자 선택 기능은 제공하지 않는다.
제품 메시지는 알림톡만 사용하며 SMS/LMS 또는 대체 발송을 화면에 노출하지
않는다.

소유 화면은
`src/app_admin/domains/messages/pages/MessageLogPage.tsx`이고 API 투영 계약은
`backend/docs/domain/messaging-delivery-log.md`에 있다.

## 정보 구조와 상태 표시

상단 운영 요약은 접수 완료, 진행 중, 확인 필요, 종료 실패를 구분한다. 필터는
전체, 접수 완료, 진행 중, 확인 필요, 실패를 제공하며 `processing`, `sending`,
`retryable_failed`, `failed`, `ambiguous`를 하나의 실패로 합치지 않는다.

- `접수 완료`: 공급자가 알림톡 요청을 접수했다는 뜻이며 수신자의 카카오톡
  열람 완료를 뜻하지 않는다.
- `진행 중`: 발송 준비, 공급자 접수 확인, 자동 재시도 대기 상태를 포함한다.
- `결과 확인 필요`: 결과가 모호하여 중복 방지를 위해 자동 재발송하지 않는
  상태다.
- `발송 실패`: 종료된 실패만 나타낸다.

목록의 `기록 시각`은 모델의 `sent_at`, 즉 로그 행 생성 시각이다. 상세의
`작업자 처리 시작`은 `claimed_at`이다. 공급자 처리 완료 시각은 현재 계약에
없으므로 화면에서 추정하지 않는다.

## 상세와 개인정보

목록은 본문 없이 빠르게 조회한다. 행을 열 때만 상세 API를 호출하고, 서버가
반환한 표시 범위를 그대로 따른다.

- `available`: owner/admin에게 저장된 개인정보 제거 본문 표시
- `sensitive_redacted`: 자격증명·인증 유형이므로 원문이 저장되지 않았다는
  보안 안내 표시
- `restricted`: staff/teacher에게 본문 권한 제한 안내 표시
- `not_recorded`: 저장된 본문이 없음을 표시하며 내용을 추정하지 않음

공급자 증거는 서버가 owner/admin에게 정확한 메시지 ID를 반환하면 운영 대사용
근거로 표시하고, 그 외 역할은 마스킹 참조와 확인 여부만 표시한다. 실패 사유는
서버의 안전한 요약만 사용하고 공급자 원문을 렌더링하지 않는다.

## 반응형·접근성 계약

- 넓은 화면은 운영 레저 테이블, 680px 이하 화면은 카드 목록으로 전환한다.
- 390px에서 문서·목록·상세 모달에 가로 스크롤이 생기지 않아야 한다.
- 상태는 색상만으로 전달하지 않고 텍스트와 아이콘을 함께 사용한다.
- 필터와 행은 키보드 포커스가 보이고, 상세는 제목이 연결된 dialog로 연다.
- 로딩·빈 목록·조회 실패·상세 실패 상태를 분리하고 실패 시 다시 시도할 수
  있어야 한다.

## 검증

```powershell
pnpm typecheck
pnpm exec eslint src/app_admin/domains/messages/pages/MessageLogPage.tsx src/app_admin/domains/messages/api/messages.api.ts src/app_admin/domains/messages/queryKeys.ts e2e/admin/messaging-log-ux.mock.spec.ts
$env:E2E_BASE_URL='http://127.0.0.1:5187'
pnpm exec playwright test e2e/admin/messaging-log-ux.mock.spec.ts --project=chromium --reporter=list
```

E2E는 정확한 상태명, 상세를 열 때만 발생하는 본문 조회, 민감 본문·공급자
증거 안내와 390px overflow를 고정한다.
