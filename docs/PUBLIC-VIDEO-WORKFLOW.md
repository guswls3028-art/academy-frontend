# 공개 영상 추가와 복구

관리자의 영상 폴더 탐색(`/workspace/videos/tree`)과 교사의 영상 화면
(`/workspace/mobile/videos`)은 아직 영상 공간이 없는 tenant에서도 첫 영상을
추가할 수 있어야 한다. 권한, ID, visibility, 서버 원자성과 배포 호환은
[백엔드 공개 영상 계약](../../backend/docs/domain/public-video-session.md)이 소유한다.

`src/shared/api/contracts/videos.ts`가 GET 조회와 POST 준비를 소유한다.
GET의 JSON `null`만 미준비 상태이다. HTTP/네트워크 오류나 잘못된 응답은 reject하며
빈 성공으로 바꾸지 않는다. POST는 양의 정수 lecture/session ID를 받아야 성공이다.

- 관리자 조회는 GET만 실행한다. 미준비 상태에서도 `영상 추가`와 `폴더 생성`을
  사용할 수 있다. 명시적 추가 동작에서 POST 준비가 성공하면 cache에 ID를 반영하고
  업로드 창 또는 폴더 생성을 진행한다. 조회 오류는 기존 재시도 화면을 유지한다.
  준비/폴더 생성 실패는 오류를 표시하고 폴더 이름을 보존하여 다시 생성할 수 있다.
- 교사 파일 선택과 YouTube 제출은 먼저 POST 준비를 완료한 뒤 기존 업로드 또는
  링크 생성 API를 실행한다. 준비 실패 시 후속 업로드를 실행하지 않는다.
  YouTube 제목/URL은 보존하며 동일 제출로 재시도한다. 파일은 기존 파일 선택
  동작으로 재선택할 수 있다. pending이 끝나면 다시 사용할 수 있어야 한다.
  YouTube 입력은 공용 `BottomSheet`를 사용하여 하단 메뉴가 제출 버튼을 덮지 않게 한다.
- 교사 영상 목록의 최초 조회 실패는 오류와 `다시 시도`를 표시한다. 성공한 0건만
  첫 영상 추가 안내를 표시하며, HTTP/네트워크 실패를 빈 목록으로 취급하지 않는다.
  기존 목록을 받은 뒤 갱신에 실패하면 마지막 목록과 갱신 실패 안내를 함께 유지한다.
  목록 재시도 중 버튼은 비활성·busy 상태이며 같은 요청을 중복 시작하지 않는다.
  복구되면 최신 목록을 표시하고 오류 안내를 닫는다. 검색·필터·추가 폼은 유지한다.
- 일반 차시 업로드, 업로드 파이프라인과 영상 권한 정책은 변경하지 않는다.

`e2e/admin/public-video-preparation.mock.spec.ts`는 desktop/390px에서 미준비 추가,
조회 실패 복구, 교사 목록의 최초 실패·정상 0건·기존 목록 갱신 실패와 재시도,
준비 실패 후 입력 유지/재시도, 폴더·링크·파일 결과의 reload 표시를
검증한다. route mock의 저장 상태는 실제 서버 DB/worker/재생 검증이 아니다.
동일 산출물 격리 개발 canary의 `student-parent-learning-realuse.spec.ts`는 기존 합성
영상이 관리자 계정의 교사 목록에도 실제 API로 표시되고 PC/390px에서 reload 뒤 유지되는지
검증한다. 이는 교사 화면의 조회 검증이며 별도 `staff` 역할 권한이나 영상 처리 검증은 아니다.
Backend 전체 rolling 완료 후 frontend를 승격하며, 열린 old frontend의 미준비
tenant까지 자동 복구됐다는 완료 주장을 하지 않는다. 실제 개발환경·학생 재생은
release 소유자의 후속 실사용 검증에서 확인한다.
