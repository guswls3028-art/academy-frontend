📐 STUDENTS DOMAIN UI SSOT

Students UI Design Single Source of Truth

이 문서는 features/students 영역의 레이아웃, 탭, 카드, 테이블, 오버레이 패턴을
고정된 디자인 규칙(SSOT) 으로 정의한다.

이 문서에 명시되지 않은 UI 변형은 금지하며,
다른 도메인(staff, lectures, exams 등)도 동일 규칙을 그대로 따른다.

1. 최상위 레이아웃 규칙 (Domain Layout)
1.1 Domain Layout 구조

모든 도메인 페이지는 반드시 다음 구조를 따른다.

[ Domain Header ]
 ├─ Accent Bar (Primary Color)
 ├─ Title (text-2xl / bold)
 ├─ Description (text-base / muted)
 └─ Domain Tabs (ds-tabs)

[ Domain Content ]
 └─ Rounded Card (radius-2xl, border)
    └─ Outlet

1.2 StudentsLayout.tsx 책임

도메인 타이틀, 설명, 탭 UI를 전담

실제 페이지 내용은 절대 포함하지 않는다

내부 페이지는 반드시 <Outlet />으로 렌더링

✔ 허용

탭 잠금 (disabled, pointer-events-none)

설명 문구 변경

❌ 금지

테이블 / 카드 직접 포함

API / 상태 로직 포함

2. 도메인 탭 규칙 (Tabs)
2.1 탭 기본 원칙

모든 도메인은 ds-tabs + ds-tab 사용

텍스트 크기: text-[15px] font-semibold

활성 상태: is-active 클래스

2.2 잠금 탭 규칙 (LOCKED TAB)

아직 구현되지 않은 기능은 노출은 하되 클릭 불가 처리한다.

필수 조건

disabled

pointer-events-none

opacity-40

tooltip(title) 제공

const lockedTabClass =
  "opacity-40 cursor-not-allowed pointer-events-none";


❗ 라우팅은 살아 있어도 UI에서 접근 불가해야 한다

3. Domain Content 카드 규칙
3.1 공통 카드 스타일

모든 도메인 페이지는 다음 카드 스타일을 사용한다.

border-radius: rounded-2xl

background: var(--bg-surface)

border: var(--border-divider)

내부 패딩은 페이지에서 제어

<div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-divider)]">
  <Outlet />
</div>


❌ 카드 안에 또 카드 중첩 금지
❌ radius/색상 임의 변경 금지

4. 리스트 페이지 규칙 (Home Page)
4.1 HomePage 책임 분리

StudentsHomePage.tsx는 다음만 담당한다:

검색 입력

필터 모달 제어

생성/삭제 모달 제어

테이블 렌더링

라우팅 연결

❌ 금지

테이블 row 상세 구현

모달 내부 UI 구현

5. 테이블 규칙 (StudentsTable)
5.1 테이블 헤더

컬럼 헤더 배경:

color-mix(
  var(--color-brand-primary) 6%,
  var(--color-bg-surface-hover)
)


컬럼 헤더 텍스트:

color-mix(
  var(--color-brand-primary) 55%,
  var(--color-text-secondary)
)

5.2 텍스트 크기 규칙
영역	크기
이름	15px / bold
전화/학교	14px
등록일	13px
상태 뱃지	12px

👉 전화번호/식별자 포함, 전부 가독성 우선

6. 상세 페이지 규칙 (Overlay Pattern)
6.1 접근 방식

리스트 → /admin/students/:id

페이지 이동이 아니라 오버레이

backdrop 클릭 시 navigate(-1)

<div className="fixed inset-0 z-40 bg-black/60" />

6.2 Overlay 구조
[ Backdrop ]
[ Centered Overlay Panel ]
 ├─ Gradient Header
 ├─ Left Info Panel
 └─ Right Tabs Panel


max-width: 1120px

radius: 22px

box-shadow 필수

7. 정보 행(Row) 규칙 (InfoRow)

label: muted / font-weight 800

value: primary / font-weight 950

accent 행은 brand-primary 10% mix 사용

❌ 임의 아이콘, 컬러 추가 금지

8. 모달 규칙 (Create / Edit / Delete)
8.1 공통 원칙

반드시 AdminModal 사용

단축키 지원:

ESC → 닫기

⌘/Ctrl + Enter → 저장/등록

width 고정 (520 / 720)

8.2 입력 스타일

ds-input, ds-textarea, ds-select만 사용

height, padding 변경 금지

9. 다른 도메인 적용 규칙 (MANDATORY)

이 SSOT는 다음 도메인에 그대로 복사 적용한다.

features/staff

features/lectures

features/exams

features/clinics

✔ 이름/문구만 변경 가능
❌ 구조/패턴 변경 불가

10. 변경 정책 (LOCK)

이 문서 변경 = 디자인 기준 변경

변경 시:

SSOT 문서 수정

모든 도메인 동시 반영

부분 적용 금지