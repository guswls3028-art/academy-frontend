# 프론트엔드 타입 vs 백엔드 API 응답 스펙 불일치 가능성 분석

**기준:** 백엔드 코드(serializers, views) 기준  
**수정 없음:** 분석만 수행, 코드 변경 없음

---

## 1. 요약: 불일치 가능성 있는 항목

| 구분 | API/도메인 | 불일치 내용 | 심각도 |
|------|------------|-------------|--------|
| 1 | Admin Exam Results | 백엔드는 **배열** 반환, 프론트는 **`{ count, next, previous, results }`** 기대 | **높음** |
| 2 | Question Stats | 백엔드는 **배열** 반환, 프론트는 **`{ count, next, previous, results }`** 기대 | **높음** |
| 3 | Student Dashboard | 백엔드는 **`notices`, `today_sessions`, `badges`** 모두 반환, 프론트 타입은 **`badges`만** 정의 | 중간 |
| 4 | Admin OMR Upload | 프론트는 **단일 파일** `POST .../admin/omr-upload/` → `{ submission_id, status }` 기대, 백엔드에는 해당 액션 없음. 배치 전용 응답은 `{ created_count, submission_ids }` | **높음** |
| 5 | Student Exam `pass_score` | 백엔드 시리얼라이저는 **IntegerField**, 모델/실제값이 float일 수 있음. 프론트는 `number` | 낮음 |

---

## 2. API별 상세 비교

### 2.1 인증 (Login)

- **프론트:** `LoginResponse = { access: string; refresh: string }`
- **백엔드:** 토큰 뷰는 `core`가 아닌 DRF JWT 등 외부 설정 가능. 일반적으로 `access`, `refresh` 반환 시 **일치**.

---

### 2.2 Student Dashboard

- **프론트:** `StudentDashboardResponse = { badges: StudentDashboardBadges }`  
  - `notices`, `today_sessions` 타입 없음.
- **백엔드:** `StudentDashboardSerializer`  
  - `notices` (DashboardNoticeSerializer many), `today_sessions` (DashboardSessionSerializer many), `badges` (DictField, required=False).  
  - 뷰에서 `{"notices": [], "today_sessions": [], "badges": {}}` 반환.

**불일치:**  
- 백엔드는 **세 필드 모두** 내려줌.  
- 프론트 타입은 **badges만** 있어, `notices`/`today_sessions`를 쓰려면 타입 정의가 없어 타입 안전성 부족.  
- 실제로 프론트 `fetchStudentDashboard`는 `data.badges`만 사용하고 나머지는 무시하므로 **동작은 하되, 스펙/타입은 불완전**.

---

### 2.3 Session Scores (성적 탭)

- **프론트:** `SessionScoresResponse = { meta: SessionScoreMeta; rows: SessionScoreRow[] }`  
  - `ScoreBlock`에 `meta?: { status?: string | null }` (옵셔널).
- **백엔드:**  
  - `SessionScoresView`가 `{"meta": meta, "rows": ...}` 반환.  
  - `ScoreBlockSerializer`: `meta` 필드 없음.  
  - `meta.homeworks[].unit`: 뷰에서 `None`으로 고정.

**불일치:**  
- `block.meta`는 백엔드가 보내지 않음. 프론트는 옵셔널로 두었으므로 **계약상 문제 없음**.  
- `meta.homeworks[].unit`은 백엔드 `None` ↔ 프론트 `string | null` 로 **일치**.

---

### 2.4 Student Exams (목록/상세)

- **프론트:** `ExamsListResponse = { items: StudentExam[] }`, `StudentExam.pass_score: number`
- **백엔드:**  
  - `StudentExamListView.get()` → `Response({"items": []})` (빈 목록만 반환).  
  - `StudentExamSerializer`: `pass_score = IntegerField()`.

**불일치:**  
- 목록/상세 구조(`items` 포함)는 **일치**.  
- `pass_score`: 백엔드 시리얼라이저는 **정수**, 프론트는 `number`. 실제 DB/모델이 float이면 JSON에서 숫자로 오므로 **실질적 문제는 낮음**.

---

### 2.5 Exam Enrollments (시험 응시 대상 관리)

- **프론트:** `ExamEnrollmentManageResponse = { exam_id, session_id, items: ExamEnrollmentRow[] }`
- **백엔드:** `ExamEnrollmentManageView.get()` → `{ "exam_id", "session_id", "items": ExamEnrollmentRowSerializer(many=True).data }`

**일치.**

---

### 2.6 Homework Assignments

- **프론트:** `HomeworkAssignmentsResponse = { items: HomeworkAssignmentItem[]; selected_ids: number[] }`  
  - 실제로 `selected_ids`는 클라이언트에서 `items`로부터 계산.
- **백엔드:** `HomeworkAssignmentManageView` → `{"items": HomeworkAssignmentRowSerializer(...).data}` 만 반환.

**불일치:**  
- 응답 본문에는 **items만** 있음. `selected_ids`는 프론트에서 파생하므로 **API 스펙과 타입 정의만 정리하면 됨** (불일치로 인한 런타임 오류는 없음).

---

### 2.7 Wrong Notes (오답노트)

- **프론트:** `WrongNoteResponse = { count, next, prev, results }` (next/prev: number | null)
- **백엔드:** `WrongNoteView` → offset 기반으로 `next`/`prev`를 **정수(offset)** 로 반환. `WrongNoteListResponseSerializer`: count, next, prev, results.

**일치.**  
- WrongNoteItem 필드(attempt_created_at, answer_type, is_correct, score, max_score, meta, extra)도 백엔드 시리얼라이저와 대응.

---

### 2.8 Wrong Note PDF

- **프론트:** `WrongNotePDFCreateResponse`, `WrongNotePDFStatusResponse` (job_id, status, file_path, file_url, error_message, created_at, updated_at)
- **백엔드:** `WrongNotePDFStatusSerializer` 동일 필드.

**일치.**

---

### 2.9 Admin Exam Results (시험별 결과 목록)

- **프론트:** `AdminExamResultsResponse = { count: number; next: number | null; previous: number | null; results: AdminExamResultRow[] }`  
  - `useAdminExamResults`에서 `res.results`로 배열을 꺼냄.
- **백엔드:** `AdminExamResultsView.get()` → **배열만** 반환:  
  `Response(AdminExamResultRowSerializer(rows, many=True).data)`  
  - `{ count, next, previous, results }` 래퍼 없음.

**불일치 (높음):**  
- 백엔드가 **배열**을 그대로 반환하므로 `res.data`가 배열.  
- 프론트는 `res.results`를 쓰므로 `undefined`가 되고, `Array.isArray(res?.results) ? res.results : []` → **항상 빈 배열**이 되어 목록이 비어 보일 수 있음.

---

### 2.10 Question Stats (문항별 통계)

- **프론트:** `QuestionStatsResponse = { count, next, previous, results: QuestionStat[] }`  
  - `useQuestionStats`에서 `statsRes?.results` 사용.
- **백엔드:** `AdminExamQuestionStatsView.get()` → **배열만** 반환:  
  `Response(QuestionStatSerializer(data, many=True).data)`  
  - 페이지네이션 래퍼 없음.

**불일치 (높음):**  
- 백엔드 응답이 배열이므로 `res.results`는 `undefined`.  
- `Array.isArray(statsRes?.results) ? statsRes.results : []` → **항상 빈 배열**이 되어 통계가 비어 보일 수 있음.

---

### 2.11 Admin OMR Upload (단일 파일 업로드)

- **프론트:**  
  - `POST /submissions/submissions/admin/omr-upload/`  
  - FormData: enrollment_id, target_id(exam_id), file  
  - 기대 응답: `AdminOmrUploadResponse = { submission_id: number; status: SubmissionStatus }`
- **백엔드:**  
  - `SubmissionViewSet.get_serializer_class()`에 `admin_omr_upload` 액션이 언급되나, **해당 custom @action이 뷰에 정의되어 있지 않음**.  
  - 실제 노출된 OMR 관련 엔드포인트:  
    - `POST submissions/exams/<exam_id>/omr/` (ExamOMRSubmitView)  
    - `POST submissions/exams/<exam_id>/omr/batch/` (ExamOMRBatchUploadView)  
      - 응답: `{ created_count, submission_ids }` (201)

**불일치 (높음):**  
- 프론트가 호출하는 **`/submissions/submissions/admin/omr-upload/`** 에 해당하는 뷰가 없으면 **404**.  
- 배치 업로드만 사용할 경우, 응답 형태도 `{ submission_id, status }`가 아니라 `{ created_count, submission_ids }`로 다름.

---

### 2.12 Video Upload Init

- **프론트:** `UploadInitResponse = { video: Video; upload_url: string; file_key: string; content_type: string }`
- **백엔드:** `upload_init` 액션 → `{"video": VideoSerializer(video).data, "upload_url", "file_key", "content_type"}`

**일치.**

---

### 2.13 Video (목록/정책 영향 등)

- **프론트:** Video, PolicyImpactResponse 등
- **백엔드:** VideoSerializer, PolicyImpact 관련 뷰와 필드

**일치 가능성 높음.** (필드명/타입 세부는 별도 점검 시 유리)

---

### 2.14 Student Media (세션별 영상 목록 / 재생)

- **프론트:** `StudentSessionVideosResponse = { items: StudentVideoListItem[] }`, `StudentVideoPlayback`
- **백엔드:**  
  - `StudentSessionVideoListView` → `{"items": StudentVideoListItemSerializer(...).data}`  
  - `StudentVideoPlaybackSerializer`: video, hls_url, mp4_url, policy (DictField)

**일치.**

---

### 2.15 Admin Exam Result Row 필드

- **백엔드:** `AdminExamResultRowSerializer`: enrollment_id, student_name, exam_score, exam_max_score, final_score, passed, clinic_required, submitted_at, submission_id, submission_status
- **프론트:** `AdminExamResultRow`: enrollment_id, student_name, final_score, passed, clinic_required, submission_status, submitted_at, submission_id (optional 등). 주석에 "exam_score/exam_max_score는 list contract에 없음"

**불일치 없음:**  
- 백엔드는 여전히 exam_score, exam_max_score를 보냄. 프론트 타입에서 선택적으로 받지 않아도 런타임에는 문제 없음. (타입에 명시하면 더 정확해짐)

---

## 3. 권장 조치 (참고만, 수정 없음)

1. **Admin Exam Results / Question Stats**  
   - 백엔드: 응답을 `{ count, next, previous, results }` 형태로 감싸거나,  
   - 프론트: 응답이 배열인 경우 `Array.isArray(res.data) ? res.data : (res.data?.results ?? [])` 같이 배열/래퍼 둘 다 처리하도록 수정 검토.

2. **Student Dashboard**  
   - 프론트 타입에 `notices`, `today_sessions` 추가하여 백엔드 스펙과 맞추기 검토.

3. **Admin OMR Upload**  
   - 백엔드에 단일 파일용 `admin_omr_upload` 액션을 추가하거나,  
   - 프론트를 배치 업로드 엔드포인트(`/submissions/exams/{examId}/omr/batch/`) 및 `{ created_count, submission_ids }` 스펙에 맞추기 검토.

4. **Homework Assignments**  
   - `HomeworkAssignmentsResponse`에서 `selected_ids`를 “API 응답 필드”가 아니라 “파생 필드”로 타입/주석 정리 검토.

---

**문서 생성일:** 2025-02-12  
**기준:** academy(백엔드), academyfront(프론트) 저장소
