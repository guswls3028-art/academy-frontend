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
4. 검수 초안은 왼쪽 편집기와 오른쪽 인쇄 미리보기로 연다. 기본 정보·리포트
   목적·총평, 출제 기조, 핵심 변별 X-ray, 오류 패턴·회복 행동과 결론은 접을 수
   있는 섹션으로 나누고, 전 문항은 동시에 펼치지 않는다. `미검수/전체` 필터와
   가로 문항 rail에서 한 문항만 집중 편집하므로 25문항에서도 현재 위치와 남은
   작업을 잃지 않는다.
5. 편집기 상단의 `선생님 최종 검수 현황`은 서버 readiness의 완료 문항 수,
   미검수 문항 수와 섹션별 충족 여부만 표시한다. 미검수 답안이나 AI 문구로
   임의의 설득력 100%를 만들지 않는다. 원문 OCR 발췌는 기본 접힘 상태이며
   오인식 가능성과 원본 시험지 우선 원칙을 함께 표시한다. 난이도·핵심
   포인트·학생이 빠질 함정·출제 검토 메모·정답 예시·타당성과 번호는 선생님이
   수정하고 `원문·정답 대조 완료`를 문항마다 누른다. 내용을 다시 고치면 해당
   문항은 자동으로 미검수로 돌아간다. 핵심 변별 항목도 문항 번호와
   실제로 막히는 지점, 증거·붕괴 분기 3개·복구 4단계까지 편집한다. 부족한
   핵심 변별 항목은 8개까지 추가하되 대표 X-ray는 3개를 조판하고, 오류 패턴은 4개까지,
   성취 관측 구간은 3개까지 직접
   추가할 수 있다. 숨은 source 번호가 근거 연결을 유지하며,
   오인식 문항을 삭제하면 저장·재조회 뒤에도 되살아나지 않는다. 교사가 추가한
   문항은 기존 원문 번호와 표시 번호가 겹쳐도 별도 항목으로 남고, 문항 수와
   난도 분포는 저장된 검수본에서 다시 계산된다.
6. 저장 성공 뒤 dirty 표시가 사라진다. version 충돌은 오류로 알리고 기존
   화면의 변경을 조용히 덮어쓰지 않는다. 저장·문항 추가·삭제·모든 내용 수정은
   현재 최종 검수 확정을 자동 해제한다.
7. 모든 문항과 필수 섹션이 준비되면 `최종 검수 확정`이 현재 version의 서버
   fingerprint를 고정한다. 확정 전에는 PDF/PPTX와 `홈페이지 공개` 버튼을
   비활성화하고, 이전 산출물도 검수 증표가 없으면 다시 받지 못한다.
8. `EXAM SPECTRUM EXPORT` 영역은 PDF와 PPTX를 각각 명시적인 카드로 보여 준다.
   확정된 현재 버전만 async export 완료 뒤 새 presigned URL로
   내려받는다. 생성 중 단계·퍼센트, 실패 원인·재시도, 완료 파일명·버전·
   fingerprint와 이전 산출물의 다시 받기를 같은 화면에서 확인한다. 절전 중인
   Tools 워커의 자동 기동을 포함해 최대 8분까지 상태를 추적하고, 한 형식을
   만드는 동안 다른 형식 버튼도 잠가 중복 작업을 직렬화한다. 제한 시간이
   지나도 서버 작업을 실패로 단정하지 않고 계속 진행 중임을 안내하며, 같은
   버튼이나 이전 산출물에서 상태 확인을 이어 간다.
9. `홈페이지 공개`는 최종 검수 확정 뒤 확인 창을 거쳐 검수 증표가 포함된 공개
   스냅샷을 게시한다. 같은 리포트가 이미 공개됐다면 URL은 유지하고 최신
   검수본으로 갱신한다. 성공 후 `공개본 보기`로 새 공개 글을 확인할 수 있다.

## 공개 분석 글의 정보 구조

- `/landing/analysis/:id`는 PDF 뷰어가 아닌 검색·공유 가능한 네이티브 글이다.
- 첫 화면은 시험 결론과 분석 문항, 서답형 수, 상·최상 배점, 핵심 변별 군을
  보여 주고, 업로드 시험지 근거와 실제 정답률·학교 성적 분포의 부재를 함께
  고지한다.
- 본문은 총평 -> 선택형·서답형 구조 -> 문항 순서 난도 지도 -> 영역·난도별
  배점 -> 시험의 결정적 특징 -> 변별 문항 군의 원인·처방 -> 실패 패턴 ->
  학부모 설명 -> 전 문항 근거표 -> 다음 수업 순서로 이어진다.
- 영역·난도 막대와 문항 지도는 공개 스냅샷의 실제 문항·배점을 파싱해 그린다.
  배점이 없으면 문항 수를 쓰고 숫자를 추정하지 않는다.
- 모바일에서는 전 문항 표를 가로 스크롤에 맡기지 않고 문항별 근거 카드로
  바꾼다. 목차는 본문 상단의 2열 격자로 전환해 모든 섹션과 PDF 대체 링크를
  화면 안에 함께 보여 주며, 가로로 숨겨진 조작 요소나 별도 크게 보기 동작에
  의존하지 않는다.

## 상태와 실패 처리

- loading: 최근 목록 spinner, 분석 progress, 저장/format별 export 버튼 loading
- empty: 최근 리포트 없음과 첫 시작 안내
- success: 분석 완료, 저장, 다운로드를 toast로 알림
- failure: 화면 상단 오류 banner와 toast를 함께 제공한다. 분석 실패 report는
  원인을 보이고 새 리포트 만들기로 복귀한다.
- repeat/reload: 최근 20개 teacher-owned report를 최신 수정순으로 읽고 분석 중
  report도 다시 polling한다. 최근 12개 산출물도 저장된 artifact 상태로 복원한다.
- unsaved navigation: dirty 초안에서 다른 report나 새 report로 이동할 때 확인한다.
- publication: 공개본은 내부 메모·원문 OCR 조각·경고를 포함하지 않는다. 공개
  API 실패 시 편집 화면과 기존 저장본은 유지하고 상단 오류와 toast로 알린다.

## 반응형·접근성·모션

- 1180px 아래에서는 라이브 미리보기를 본문 끝에 쌓지 않고 `미리보기` 버튼으로
  여는 전체 화면 overlay로 바꾼다. 닫기 버튼과 Escape를 지원하고 열린 동안
  배경 스크롤을 잠근다.
- 390px에서는 upload metadata, 문항 헤더, 편집 field와 PDF/PPTX action이 한
  열로 줄어들며 페이지 자체에 가로 overflow가 생기지 않는다. 실제 파일명과
  version/fingerprint는 말줄임으로 숨기지 않고 줄바꿈한다.
- file input, 모든 field, 삭제/뒤로가기 button에 접근 가능한 label을 둔다.
- 분석 orb/progress와 hover 상승은 상태·계층 피드백에만 사용한다.
  `prefers-reduced-motion`에서는 animation/transition을 제거한다.
- 미리보기는 `실험실의 관측 기록 + 상위권 전략 브리핑`을 표방하는 독자
  `EXAM SPECTRUM` 디자인을 사용한다. Deep Ink, Plasma Blue, Signal Coral,
  Ion Amber와 관측 rail·전 문항 spectrum을 쓰며 참고 PPT/PDF의 레이아웃·
  남색/빨강 문법은 복제하지 않는다. 실제 export 조판은 서버가 소유하고 화면
  preview를 데이터 정본으로 사용하지 않는다.

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
