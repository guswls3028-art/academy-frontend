# 성적(scores) 프론트엔드 파이프라인·스펙

## 1. 데이터 소스·쿼리 키 (SSOT)

- **쿼리 키**: `src/features/scores/api/queryKeys.ts`의 `scoresQueryKeys`만 사용.
- **session-scores**: `scoresQueryKeys.sessionScores(sessionId)`  
  - GET `/results/admin/sessions/:sessionId/scores/`  
  - 성적 탭 메인 테이블 데이터. 무효화는 저장 성공 시에만 호출.
- **exam-items**: `scoresQueryKeys.examItems(examId, enrollmentId)`  
  - GET `/results/admin/exams/:examId/enrollments/:enrollmentId/` (문항별 점수)  
  - InlineExamItemsRow 등에서 사용. 문항 저장 후 해당 키 + sessionScores(sessionId) 무효화.
- **attendance**: `scoresQueryKeys.attendance(sessionId)`  
- **session-score-summary**: `scoresQueryKeys.sessionScoreSummary(sessionId)`

## 2. API 계약

- **타입**: `sessionScores.ts`의 `SessionScoresResponse`, `SessionScoreRow`, `ScoreBlock`, `SessionScoreMeta`가 백엔드 DTO와 1:1.
- **시험 점수**: `score`(합산) = `objective_score` + `subjective_score`. 합불은 서버만 계산, `block.passed`로 전달.
- **과제**: `block.meta?.status === "NOT_SUBMITTED"` → 미제출. 판정/합불은 서버 결과만 사용.

## 3. 저장 파이프라인

| 대상 | API | 성공 시 | 실패 시 |
|------|-----|--------|--------|
| 시험 합산 | PATCH `.../score/` | sessionScores(sessionId) 무효화 | feedback.error("합산 점수 저장에 실패했습니다.") |
| 시험 객관식 | PATCH `.../objective/` | 위와 동일 | feedback.error("객관식 점수 저장에 실패했습니다.") |
| 시험 주관식 | PATCH `.../subjective/` | 위와 동일 | feedback.error("주관식 점수 저장에 실패했습니다.") |
| 시험 문항별 | PATCH `.../items/:questionId/` | sessionScores(sessionId) 무효화 | feedback.error("문항 점수 저장에 실패했습니다.") (ScoreInputCell) |
| 과제 | PATCH `/homework/scores/quick/` | sessionScores(sessionId) 무효화 | feedback.error("과제 점수/미제출 저장에 실패했습니다.") |

- **저장 헬퍼**: `ScoresTable` 내부 `saveExamTotal`, `saveExamObjective`, `saveExamSubjective`, `saveHomework`가 try/catch + invalidate + feedback 담당. 낙관적 갱신 금지.

## 4. 편집 모드·컬럼

- **편집 모드**: `SessionScoresEntryPage`에서 `isEditMode` + `examEditTotal` | `examEditObjective` | `examEditSubjective` | `homeworkEdit` 조합.
- **합산 vs 객관식/주관식**: 동시 선택 불가. 전환 시 confirm 후 전환.
- **editableCols**: `SessionScoresPanel`의 `editableCols`가 meta.exams / meta.homeworks 기반으로 생성. 문항이 있으면 주관식은 문항별(item), 없으면 주관식 한 칸(subjective).

## 5. 검증

- 점수 범위: `validateScore(value, maxScore)` → 0 ~ (maxScore ?? 100). 초과 시 feedback.error 후 저장 안 함.
- 입력 파싱: `parseScoreInput(raw, maxScore)` → 숫자 또는 `%` 접미사(퍼센트) 지원.
