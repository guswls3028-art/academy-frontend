// PATH: src/shared/ui/layout/Header.tsx
// --------------------------------------------------
// Header
// - 글로벌 상단 영역
// - 페이지 제목은 포함하지 않는다 (PageHeader 전담)
// --------------------------------------------------

export default function Header() {
  return (
    <header className="h-14 flex items-center px-6 border-b border-[var(--border-divider)] bg-[var(--bg-surface)]">
      {/* 글로벌 액션 / 로고 / 알림 영역용 (현재는 비워둠) */}
      개발자 : 우선 관리자 화면만 구경하세요... 오늘은 진짜 끝납니다.
    </header>
  );
}
