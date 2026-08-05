# 문제 리뷰 리포트 화면 계약

Last verified: 2026-08-06

## 역할과 진입점

- 역할: 현재 테넌트의 원장·관리자·강사 등 staff 사용자
- 도구 탭: `문제 리뷰 리포트`
- route: `/workspace/tools/problem-review`
- 소유 화면: `src/app_admin/domains/tools/problem-review/pages/ProblemReviewPage.tsx`
- API client: `src/app_admin/domains/tools/problem-review/api/problemReview.api.ts`
- 백엔드 정책: `backend/docs/domain/problem-review-report.md`

## 상호작용 흐름

1. 첫 화면은 가치 설명, 세 단계 흐름, 시험지 drop zone, 기본 정보, 외부 AI
   확인, 최근 리포트를 보여 준다.
2. PDF/HWP/HWPX/DOC/DOCX/이미지/ZIP을 최대 6개까지 선택한다. 외부 AI 처리
   안내에 동의하지 않으면 시작하지 않는다.
3. 분석 중에는 원문 보존과 선생님 검수 계약을 설명하고, 동일 report를 polling
   한다. 브라우저를 닫아도 최근 리포트에서 이어서 연다.
4. 검수 초안은 왼쪽 편집기와 오른쪽 인쇄 미리보기로 연다. 기본 정보·총평,
   출제 기조, 전 문항, 핵심 변별과 결론을 접을 수 있는 섹션으로 나눠 긴 시험도
   현재 맥락을 잃지 않게 한다.
5. 원문 발췌는 읽기 전용 근거로만 보인다. 난이도·핵심 포인트·학생이 빠질
   함정·출제 검토 메모와 번호는 선생님이 수정한다. 핵심 변별 항목도 문항 번호와
   실제로 막히는 지점까지 편집한다. 숨은 source 번호가 근거 연결을 유지하며,
   오인식 문항을 삭제하면 저장·재조회 뒤에도 되살아나지 않는다. 교사가 추가한
   문항은 기존 원문 번호와 표시 번호가 겹쳐도 별도 항목으로 남고, 문항 수와
   난도 분포는 저장된 검수본에서 다시 계산된다.
6. 저장 성공 뒤 dirty 표시가 사라진다. version 충돌은 오류로 알리고 기존
   화면의 변경을 조용히 덮어쓰지 않는다.
7. PDF/PPTX 버튼은 미저장 변경을 먼저 저장하고 async export 완료 뒤 새
   presigned URL로 내려받는다.
8. `홈페이지 공개`는 현재 검수본을 먼저 저장한 뒤 확인 창을 거쳐 공개
   스냅샷을 게시한다. 같은 리포트가 이미 공개됐다면 URL은 유지하고 최신
   검수본으로 갱신한다. 성공 후 `공개본 보기`로 새 공개 글을 확인할 수 있다.

## 상태와 실패 처리

- loading: 최근 목록 spinner, 분석 progress, 저장/format별 export 버튼 loading
- empty: 최근 리포트 없음과 첫 시작 안내
- success: 분석 완료, 저장, 다운로드를 toast로 알림
- failure: 화면 상단 오류 banner와 toast를 함께 제공한다. 분석 실패 report는
  원인을 보이고 새 리포트 만들기로 복귀한다.
- repeat/reload: 최근 20개 teacher-owned report를 최신 수정순으로 읽고 분석 중
  report도 다시 polling한다.
- unsaved navigation: dirty 초안에서 다른 report나 새 report로 이동할 때 확인한다.
- publication: 공개본은 내부 메모·원문 OCR 조각·경고를 포함하지 않는다. 공개
  API 실패 시 편집 화면과 기존 저장본은 유지하고 상단 오류와 toast로 알린다.

## 반응형·접근성·모션

- 1180px 아래에서는 편집기와 미리보기를 세로로 쌓는다.
- 390px에서는 upload metadata, 문항 헤더, 편집 field가 한 열로 줄어들며 페이지
  자체에 가로 overflow가 생기지 않는다. 다운로드 action은 동일 폭 세 칸으로
  유지한다.
- file input, 모든 field, 삭제/뒤로가기 button에 접근 가능한 label을 둔다.
- 분석 orb/progress와 hover 상승은 상태·계층 피드백에만 사용한다.
  `prefers-reduced-motion`에서는 animation/transition을 제거한다.
- 미리보기는 참고 PPT/PDF의 navy + red editorial rail을 따르되 실제 export
  조판은 서버가 소유한다. 화면 preview를 데이터 정본으로 사용하지 않는다.

## 집중 검증

```powershell
pnpm typecheck
pnpm exec eslint src/app_admin/domains/tools/problem-review src/app_admin/domains/tools/ToolsLayout.tsx src/app_admin/domains/tools/ToolsRoutes.tsx
pnpm build
pnpm exec playwright test e2e/admin/problem-review-report.mock.spec.ts e2e/landing-problem-analysis.mock.spec.ts --project=chromium --reporter=list
```

브라우저 검증은 1366px desktop과 390px mobile에서 최초 화면, 분석 loading,
편집/save, PDF/PPTX 완료, 오류, 최근 리포트 재진입을 확인한다. screenshot만으로
닫지 않고 DOM 값과 저장 후 reload 상태를 함께 assertion한다.
