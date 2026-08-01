# 강의 정규 수업·보강 진입 계약

## 목적과 진입점

원장과 선생님은 관리자 앱의 **강의 → 강의 상세**에서 정규 진도 수업과 보강
수업을 섞지 않고 관리한다. 화면 상단의 `정규 수업`과 `보강` 탭이 진입 범위를
소유하며, 각 탭은 해당 유형의 수업 수를 함께 보여 준다.

데이터와 권한 규칙은
[backend/docs/domain/lecture-sessions.md](https://github.com/guswls3028-art/academy-backend/blob/main/docs/domain/lecture-sessions.md)가
소유한다.

## 상호작용

1. 강의 상세에 처음 들어오면 `정규 수업`을 선택하고 정규 차시만 보여 준다.
2. `보강`을 누르면 주말 클리닉 같은 보강 수업만 보여 준다.
3. 차시 상세에서 범위를 바꾸면 현재 반을 우선해 그 유형의 첫 수업으로
   이동하고, 출결·성적·시험·과제 등 현재 업무 탭은 유지한다.
4. 해당 유형에 수업이 없으면 첫 수업을 추가하도록 안내한다.
5. 각 범위의 추가 버튼은 생성 모달에서 같은 유형을 미리 선택한다.
6. 보강 생성 시 `보강 이름`을 입력한다. 저장 이름은 강의 카드, breadcrumb,
   출결·성적 등 수업 표시에 재사용된다.
7. 보강 카드의 설정 메뉴에서 이름과 날짜를 수정한다. 이름 수정은 현재 상세
   화면을 닫거나 다른 경로로 이동시키지 않으며, 저장 후 재조회해 유지한다.

반 편성 기능을 사용하는 tenant에서도 같은 유형 탭을 먼저 적용한 뒤 공통 수업과
반별 수업 레인을 보여 준다. 탭을 바꿔도 반 구조나 수업 ID는 바뀌지 않는다.

## 상태와 실패 처리

- 로딩 중에는 목록 로딩 상태를 표시한다.
- 목록 조회 실패 시 오류 문구와 `다시 불러오기`를 제공한다.
- 선택 유형이 비어 있으면 정규/보강에 맞는 추가 CTA를 제공한다.
- 생성·수정 실패는 서버 메시지를 가능한 범위에서 보여 주고 기존 카드 이름을
  유지한다.
- 이름이 긴 보강은 카드 안에서 두 줄로 제한하지만 상세 경로와 접근 가능한 이름은
  전체 저장값을 사용한다.

## 접근성과 반응형

- 유형 전환은 `tablist`/`tab`과 `aria-selected`를 사용한다.
- 현재 수업 카드는 기존 `aria-current`/선택 윤곽 계약을 유지한다.
- 보강 설정과 추가 버튼은 각각 `보강 설정`, `보강 추가`라는 명확한 접근 가능한
  이름을 가진다.
- 1366px, 1100px 데스크톱과 390px 모바일에서 두 유형 탭과 현재 범위의 첫
  수업에 키보드·터치로 접근할 수 있어야 한다.

## 구현과 검증

- 유형·표시 이름 SSOT: `src/shared/product/sessions/sessionOrdering.ts`
- 강의/차시 공용 진입 UI: `src/app_admin/domains/sessions/components/SessionBlock.tsx`
- 생성 UI: `src/app_admin/domains/lectures/components/SessionCreateModal.tsx`
- 브라우저 회귀: `e2e/admin/lecture-session-scopes.mock.spec.ts`

```powershell
pnpm typecheck
pnpm exec playwright test e2e/admin/lecture-session-scopes.mock.spec.ts --project=chromium
pnpm guard:legacy-api
pnpm lint
pnpm build
```
