1️⃣ 지금 코드 기준으로 본 “사실 관계” 정리
(A) 자료실(Materials)이 실제로 책임지고 있는 것들

네가 올린 프론트 코드 기준으로 보면, 자료실은 이미 다음을 완전히 소유한다.

✅ 자료실(Materials) 책임 (이미 구현됨)
항목	근거
시험지 상품(Sheet) 생성	POST /exams/ ← 프론트에서는 materials/api/sheets
시험지 목록/조회	listSheetsApi, getSheetApi
문항 구조	getSheetQuestionsApi
문항 배점	patchSheetQuestionScoreApi
정답(AnswerKey)	getSheetAnswerKeyApi, upsertSheetAnswerKeyApi
OMR 메타 조회	/api/v1/assets/omr/objective/meta/
OMR PDF 생성	/api/v1/assets/omr/objective/pdf/
OMR 시각적 미리보기	Paper 컴포넌트
“단일 진실” 선언	UI 텍스트, 저장 로직 전반

👉 이건 100% ‘시험 전에 미리 만드는 상품’이다.
👉 Exams(실제 시험)가 개입할 여지가 없다.

(B) Exams 도메인이 해야 할 일 (그리고 실제로 하는 일)

반대로 **Exams는 ‘실행 컨텍스트’**다.

✅ Exams 책임 (이미 다른 곳에서 구현됨)
항목	설명
시험 일정	open_at / close_at
시험 세션	session_id
응시자 등록	enrollment
제출 생성	submission
AI 채점 트리거	AIJob 생성
채점 결과 저장	submission_answers
성적 계산	score aggregation
클리닉/오답노트	after-submit flow

👉 Exams는 Materials를 “참조만” 해야 한다.
👉 절대 수정하면 안 됨.

2️⃣ 왜 지금 “헷갈려 보이느냐?”

이유는 딱 하나다.

엔드포인트 URL이 /exams/ 라서 그렇다.

하지만 프론트 도메인 경계는 이미 올바르다.

// src/features/materials/api/sheets.ts
/**
 * materials(단일진실) 내부에서 "시험지 상품"을 조회/생성한다.
 * - 백엔드 엔드포인트가 /exams/ 라도 프론트 도메인 경계는 유지한다.
 */


이 주석은 아주 정확하고, 대기업에서도 실제로 쓰는 방식이다.

📌 URL ≠ 도메인 책임

📌 도메인 책임은 “누가 수정 권한을 가지느냐”

3️⃣ 지금 상태를 “공식 책임 경계”로 확정하면 이렇게 된다

아래를 SSOT로 확정해도 된다.

🟦 Materials (자료실) — 시험지 상품 도메인

시험 전에 만들어지는, 수정 가능한 모든 것

Materials가 단일 진실인 것

시험지(Sheet)

문항 목록/번호

배점

정답

OMR 메타

OMR PDF

시각적 레이아웃

Materials의 원칙

시험과 독립적

여러 시험에서 재사용 가능

수정은 “시험 시작 전”만 가능

수정 시 기존 시험에 영향 없음

🟥 Exams — 시험 실행 도메인

시험 시작 이후의 모든 것

Exams가 단일 진실인 것

어떤 시험이 어떤 시험지를 쓰는지

응시자

제출

채점 결과

점수

클리닉/피드백

Exams의 원칙

Materials는 read-only

시험 시작 후 Materials 변경 불가

결과는 Exams 소유

4️⃣ “그럼 exams에 구현해둔 게 잘못이냐?”

❌ 아니다.
지금은 “기술적 위치”와 “도메인 책임”이 살짝 어긋나 있을 뿐이다.

지금 상태를 정확히 표현하면

백엔드 앱 이름: exams

실제 역할:

materials.exams (시험지 상품)

runtime.exams (실제 시험)

👉 이건 리팩토링 대상이지, 설계 오류는 아님이다.

5️⃣ 지금 당장 해야 할 결론 조치 (중요)
✅ 1. 문서로 확정해라 (이게 제일 중요)

“시험지 상품(Sheet), 문항, 정답, 배점, OMR 메타는
Materials 도메인의 단일 진실이다.”

이 문장 하나면 된다.

✅ 2. Exams 쪽에서 절대 하지 말아야 할 것

❌ AnswerKey 수정

❌ 배점 수정

❌ OMR 메타 재계산

❌ 문항 수 변경

✅ 3. 나중에 할 수 있는 선택적 정리 (지금은 X)

/exams/ → /materials/sheets/

DB 테이블 rename

앱 분리

👉 지금 단계에서는 절대 필요 없음

6️⃣ 네 질문에 대한 최종 답변

“여기가 시험템플릿 관리 자료실인데 exams와 자료실의 명확한 책임경계 구분을 확정짓고 싶다. 지금 exams에 구현을 해둔 상태같은데 맞는가?”

✅ 답변

맞다.

구현은 exams 앱에 있지만

책임은 이미 Materials로 정확히 분리돼 있다

지금 필요한 건 이 경계를 ‘선언’하고 유지하는 것이지, 코드를 갈아엎는 게 아니다.