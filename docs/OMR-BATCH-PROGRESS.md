# OMR 대량 등록과 진행 복구

## 목적과 사용자 흐름

강의 > 차시 > 성적의 `OMR 스캔 등록`은 1~100개 파일을 한 번에 선택한다. 등록 시작 시
브라우저가 파일별 요청을 직렬로 반복하지 않고 서버 batch를 먼저 만든 뒤 한 multipart로
접수한다. 모달을 닫거나 다른 화면으로 이동해도 접수와 AI 처리 상태는 작업박스에서
계속 확인한다.

파일 접수와 AI 처리 완료는 다른 상태다. 업로드 모달의 `접수됨`은 서버가 Submission을
받았다는 뜻이고, 최종 완료·식별 필요·실패는 서버 batch를 다시 조회한 작업박스에서만
판정한다.

등록 전 목록에서 이미지 썸네일을 확인하고 위·아래 이동, 개별 삭제, 좌·우 90도 회전을
할 수 있다. 회전은 CSS 미리보기만 바꾸지 않고 등록 직전에 실제 이미지 바이트로 적용한다.
PDF는 브라우저에서 변환하지 않고 업로드 후 OMR 검토의 원본 회전 재판독을 사용한다.
재접수 batch에서는 기존 ordinal을 지키기 위해 이동만 비활성화한다.

## 서버 정본과 브라우저 경계

- 정본 API와 데이터 모델은 `backend/docs/domain/omr.md`의 대량 등록 작업 계약이 소유한다.
- 프론트는 `omr-batch:{batchId}` 메모리 task만 만들며 OMR batch를 localStorage에
  복제하지 않는다. 새로고침 복구는 tenant-scoped list/detail GET으로만 수행한다.
- localStorage에는 파일명, 학생 이름·연락처, R2 raw key를 저장하지 않는다.
- 작업박스는 현재 tenant와 로그인 직원에게 서버가 돌려준 batch만 표시한다. tenant가
  바뀐 메모리 task는 제거한다.
- list/detail poll은 완전 read-only다. terminal을 처음 관찰한 탭만 별도 completion claim
  POST를 호출하고, 서버가 `notify=true`를 준 경우에만 완료 피드백을 한 번 표시한다.
  동시 탭과 reload의 후속 claim은 `false`다.
- logout/계정 전환으로 작업박스가 비워지면 이전 session generation의 지연 list hydration,
  batch 초기화·업로드·재처리, poll·claim 응답은 같은 tenant여도 폐기한다. 각 비동기 흐름은 시작
  tenant와 generation을 고정하고, 응답 시점에 둘 중 하나가 달라졌거나 화면이 unmount됐으면
  store·안내를 갱신하지 않는다. 이전 사용자의 batch나 완료 toast를 다시 만들지 않는다.

## 표시 상태

작업박스는 총수를 보존하고 다음 수치를 동시에 표시한다.

| 표시 | 서버 의미 |
|------|-----------|
| 접수 대기 | batch ordinal은 있으나 Submission 연결 전 |
| 접수 완료 | Submission 접수 완료, 워커 처리 시작 전 |
| 동일 파일 | 같은 tenant·시험에 SHA-256이 같은 파일이 이미 접수되어 기존 답안지를 사용 |
| 처리 중 | dispatch/extract/answer/grading 단계 |
| 완료 | AI·채점 완료 |
| 식별 필요 | 학생을 자동 확정하지 못해 OMR 검토 필요 |
| 실패 | admission 또는 기존 Submission 처리 실패 |

terminal batch에는 서버가 반환한 exact exam id의 OMR 검토 화면을 직접 여는 `OMR 검토`
CTA를 제공한다. 다른 시험이나 차시로 fallback하지 않는다.

## 실패와 재시도

- multipart 응답이 끊기면 batch detail을 다시 읽어 서버가 이미 받은 ordinal과
  `pending_admission_ordinals`/`admission_failed_ordinals`를 재구성한다.
- 성공 ordinal은 다시 보내지 않는다. 원본 파일이 없는 ordinal만 순서대로 명시 재선택한다.
- 다른 batch에 같은 파일을 다시 선택해도 `duplicate_ordinals`로 완료되며 실패 재선택 대상이
  되지 않는다. 같은 파일명이라도 내용이 다르면 신규 접수한다.
- query의 batch id는 신뢰하지 않는다. detail이 현재 exam/session과 일치하고, 재선택
  ordinal이 총수 범위 안의 유한·유일한 non-empty 집합으로 검증되기 전에는 파일 선택과
  접수 버튼을 모두 잠근다. 삭제 후 재추가는 비어 있는 exact ordinal 슬롯을 재사용한다.
- 일반 접수 성공 목록을 `비우기`로 지운 뒤 새 파일을 선택하면 새 batch를 만들고 ordinal
  1부터 다시 시작한다. 이전 batch id나 `undefined`/`NaN` ordinal을 재사용하지 않는다.
- 파일이 남아 있는 worker 실패는 기존 retry action으로 재처리하고, 파일이 필요한 실패는
  같은 업로드 모달로 이동한다.
- batch/detail/retry가 다른 tenant·직원·시험과 일치하지 않으면 UI는 자동 추정하지 않고
  실패 안내만 표시한다.
- 목록 조회 중에는 loading, 일부 조회 실패에는 error+수동 새로고침, 정상 빈 목록에는
  empty를 서로 다르게 표시한다. error/unavailable 응답을 정상 empty와 함께 표시하지 않는다.
- 수동 새로고침은 영상·OMR hydration이 모두 성공했을 때만 성공 안내를 표시한다. 하나라도
  실패하면 기존 error 안내를 유지하고 성공으로 오표시하지 않는다.

## 반응형과 검증

- 1366px에서는 헤더 작업박스 드롭다운을 사용한다.
- 390px PC 업무 보기에서는 헤더 dropdown과 충돌하지 않는 로컬 작업박스를 사용하며,
  상태 칩과 OMR 검토/재시도 CTA가 가로로 잘리지 않아야 한다.
- `e2e/admin/omr-batch-progress.mock.spec.ts`는 read-only GET, terminal claim 1회,
  22개 단일 multipart, 응답 중단 후 정확한 ordinal 재선택, reload 복구,
  삭제/재추가와 비우기/재선택 ordinal, query detail fail-closed, logout 중 지연 list/upload/retry/claim,
  loading/error/empty와 수동 새로고침 partial failure, 390px overflow를 고정한다.
- 서버의 1/22/100 총수, 100건 중 부분 실패, 중복 없는 retry, tenant/creator scope와
  SHA-256 cross-batch 멱등성, PostgreSQL completion-claim race는
  `apps/domains/submissions/tests/test_exam_omr_batch_upload_pdf_guard.py`가 검증한다.
