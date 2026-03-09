# 학생앱 기능 검증 체크리스트

**목적:** 학생앱에 구현된 모든 기능을 한 번씩 눌러 보며 파이프라인(빌드·API·화면)이 정상 동작하는지 확인한다.

**전제:** 학생 또는 학부모 계정으로 로그인한 상태에서 `/student` 진입.

---

## 1. 탭바(5탭) 진입

| # | 경로 | 화면 | 확인 항목 |
|---|------|------|-----------|
| 1 | `/student/dashboard` | 홈 | 로딩 후 대시보드·오늘 일정·빠른 메뉴·공지 링크 표시 |
| 2 | `/student/video` | 영상 | 영상 홈(코스/세션 목록 또는 빈 상태) 로딩 |
| 3 | `/student/sessions` | 일정 | 내 일정 목록 로딩 (또는 빈 상태) |
| 4 | `/student/notifications` | 알림 | 알림 목록(클리닉·QnA·공지 등) 로딩 |
| 5 | `/student/more` | 더보기 | 전체 메뉴 목록·로그아웃 버튼 표시 |

---

## 2. 홈(dashboard)에서 이동

| 동작 | 이동 경로 | 확인 항목 |
|------|-----------|-----------|
| 공지사항 클릭 | `/student/notices` | 공지 목록 로딩 |
| 영상 클릭 | `/student/video` | 영상 홈 |
| 일정 클릭 | `/student/sessions` | 일정 목록 |
| 시험 클릭 | `/student/exams` | 시험 목록 |
| 성적 클릭 | `/student/grades` | 성적(시험·과제) 목록 |
| 제출 클릭 | `/student/submit` | 제출 허브 |
| 클리닉 클릭 | `/student/clinic` | 클리닉 페이지 |

---

## 3. 영상(video) 플로우

| # | 경로 | 확인 항목 |
|---|------|-----------|
| 1 | `/student/video` | 영상 홈 — 코스/공개 세션 등 표시 |
| 2 | `/student/video/courses/:lectureId` | 코스 상세 — 세션·영상 목록 |
| 3 | `/student/video/courses/public` | 공개 코스 상세 |
| 4 | `/student/video/sessions/:sessionId` | 세션별 영상 목록 |
| 5 | `/student/video/play` | 플레이어 페이지(쿼리로 영상 정보 전달) — 재생·하트비트/이벤트 API(`/media/playback/*`) 정상 호출 |

---

## 4. 일정(sessions)

| # | 경로 | 확인 항목 |
|---|------|-----------|
| 1 | `/student/sessions` | 일정 목록 로딩 |
| 2 | `/student/sessions/:sessionId` | 일정 상세 — 차시 정보·연결된 시험/과제 등 |

---

## 5. 제출(submit)

| # | 경로 | 확인 항목 |
|---|------|-----------|
| 1 | `/student/submit` | 제출 허브 — 성적표 제출·과제 제출·시험 보기 링크 |
| 2 | `/student/submit/score` | 성적표 제출 — 파일 선택·업로드(scope=student, storage API) |
| 3 | `/student/submit/assignment` | 과제 제출 — 동영상·사진 업로드 |

---

## 6. 시험(exams)

| # | 경로 | 확인 항목 |
|---|------|-----------|
| 1 | `/student/exams` | 시험 목록 — 응시 가능 시험 표시 |
| 2 | `/student/exams/:examId` | 시험 상세 — 안내·응시/결과 보기 링크 |
| 3 | `/student/exams/:examId/submit` | 시험 응시 — 문항·제출 API |
| 4 | `/student/exams/:examId/result` | 시험 결과 — 총점·문항별 정오답·합격 여부 |

---

## 7. 성적(grades)

| # | 경로 | 확인 항목 |
|---|------|-----------|
| 1 | `/student/grades` | 성적 — 시험 결과 목록·과제 이력 (`GET /student/grades/`) |

---

## 8. 더보기(more) 내 메뉴

| 메뉴 | 경로 | 확인 항목 |
|------|------|-----------|
| 시험 | `/student/exams` | 시험 목록 |
| 제출 | `/student/submit` | 제출 허브 |
| 성적 | `/student/grades` | 성적 |
| QnA | `/student/qna` | QnA 목록(내 질문) |
| 클리닉 | `/student/clinic` | 클리닉 예약/상태 |
| 클리닉 인증 패스 | `/student/idcard` | 클리닉 ID 카드(차시별 합불) |
| 출결 현황 | `/student/attendance` | 출결 placeholder |
| 프로필 | `/student/profile` | 프로필·사진·이름·비밀번호 변경 |
| 로그아웃 | (클릭) | 로그아웃 후 로그인 페이지로 이동 |

---

## 9. QnA·공지·알림

| # | 경로 | 확인 항목 |
|---|------|-----------|
| 1 | `/student/qna` | QnA 목록 — block_type qna, created_by=본인 필터 |
| 2 | `/student/notices` | 공지 목록 — `GET /community/posts/notices/` |
| 3 | `/student/notices/:id` | 공지 상세 |
| 4 | `/student/notifications` | 알림 — 클리닉·QnA·공지 등 집계 |

---

## 10. 클리닉

| # | 경로 | 확인 항목 |
|---|------|-----------|
| 1 | `/student/clinic` | 클리닉 — 예약 가능 세션·내 예약 목록 (`/clinic/sessions/`, `/clinic/participants/`) |
| 2 | `/student/idcard` | 클리닉 인증 패스 — `GET /clinic/idcard/` |

---

## 11. 프로필

| # | 경로 | 확인 항목 |
|---|------|-----------|
| 1 | `/student/profile` | 프로필 — `GET/PATCH /student/me/` (이름·사진·비밀번호) |

---

## 12. 출결

| # | 경로 | 확인 항목 |
|---|------|-----------|
| 1 | `/student/attendance` | 출결 현황 — 현재 placeholder 문구 표시 |

---

## 파이프라인 검증 명령

- **프론트 빌드:** `cd frontend && pnpm run build` → 성공 시 학생앱 청크 포함 전체 번들 생성됨.
- **라우트 파일 검증:** `node scripts/verify-student-routes.mjs` → 모든 lazy 로드 대상 파일 존재 여부 확인.

위 체크리스트대로 각 경로를 한 번씩 눌러 본 뒤, 로딩·API 호출·에러 없음 여부를 확인하면 된다.
