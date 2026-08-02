# 과제 만점·합격 정책·성적표 프런트엔드 계약

## 화면 흐름과 설정 관계

관리자·선생님은 **강의 → 차시**에서 과제를 만들고, 과제별 만점과 합격 기준을
설정한 뒤 **성적** 탭에서 학생 점수를 입력한다.

```text
과제 A 만점 + 기준 ─ 성적표 A 합격·클리닉 판정
과제 B 만점 + 기준 ─ 성적표 B 합격·클리닉 판정
과제 C 만점 + 기준 ─ 성적표 C 합격·클리닉 판정
```

- **과제 만점**은 선택한 과제 하나의 설정이다. 문제 수가 다르면 각각 다른
  만점을 지정한다.
- **과제별 합격 기준**은 선택한 과제 하나에만 적용된다. 한 회차에서 과제를
  여러 개 만들어도 퍼센트/원점수와 값을 각각 다르게 저장할 수 있다.
- 개별 기준을 아직 저장하지 않은 기존 과제는 기존 차시 기본값을 표시한다.
  설정 화면에서 저장하면 해당 과제의 개별 기준으로 고정된다.
- 프런트는 차시 공통 정책을 더 이상 수정하지 않는다. 백엔드의 기존 정책 API는
  구버전 클라이언트와 개별 기준 없는 기존 데이터의 fallback으로 유지한다.
- 차시 과제 카드에는 `만점 N점 · 기준 N%/N점`을 함께 표시해 두 범위를
  혼동하지 않게 한다.

저장·판정·tenant 불변 규칙은 백엔드
[`homework-grading.md`](https://github.com/guswls3028-art/academy-backend/blob/main/docs/domain/homework-grading.md)가
소유한다.

## 만들기·복사·설정 저장

- 과제 생성 모달은 제목, `max_score`, 과제별 커트라인을 한 요청으로 저장한다.
  여러 행의 커트라인 입력은 서로 독립이다. 만점이 1 미만이거나 해당 과제의
  원점수 커트라인보다 낮으면 아무 과제도 만들기 전에 오류를
  표시한다.
- 다른 차시 과제를 복사할 때 원본 과제의 만점과 합격 기준을 보존한다.
  100점·회차 기본 기준으로 재설정하지 않는다.
- 과제 설정의 만점 저장은 `PATCH /homeworks/{id}/`에 `max_score`를 보낸다.
  성공하면 과제 상세, 차시 과제 목록, 성적표 캐시를 모두 무효화해 새 분모를
  즉시 다시 읽는다.
- 과제 설정의 합격 기준 저장은 같은 API에 `cutline_mode`, `cutline_value`,
  `round_unit_percent`를 보낸다. 성공하면 선택 과제 상세·목록·성적표를 다시
  읽어 합불과 클리닉 대상이 즉시 맞춰진다.
- 서버 검증 오류는 입력값을 남긴 채 메시지로 보여 주며 저장 성공으로
  가장하지 않는다.

## 성적표 표시와 입력

- 성적표의 **만점 표기** 모드는 각 과제 메타의 `max_score`로 `점수/만점`을
  표시한다. 예를 들어 43점 만점에 41점이면 `41/43`이다.
- 셀 입력은 0부터 해당 과제 만점까지만 허용한다.
- 자동 저장과 `Ctrl+S` 요청에는 화면이 읽은 과제 만점을 함께 보내지만,
  최종 정본과 초과 점수 검증은 서버가 소유한다.
- 미입력 `-`, 미제출, 미배정, 검수 대기 상태를 0점과 혼동하지 않는다.
- 점수 저장 실패 시 입력값과 복구 초안을 유지하고 사용자가 다시 시도할 수
  있게 한다.

## 소유 구현과 검증

- 설정·생성: `src/app_admin/domains/homework/`
- 차시 과제 카드: `src/app_admin/domains/sessions/components/SessionAssessmentSidePanel.tsx`
- 성적표: `src/app_admin/domains/scores/components/ScoresTable.tsx`
- API 응답 정규화: `src/shared/api/contracts/assessments.ts`
- 회귀 E2E: `e2e/admin/score-entry-autosave.spec.ts`

```powershell
pnpm typecheck
pnpm exec playwright test e2e/admin/score-entry-autosave.spec.ts `
  --project=chromium --reporter=list
```
