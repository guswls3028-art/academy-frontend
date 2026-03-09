// PATH: src/features/community/pages/BoardAdminPage.tsx
// 게시판 — 디시인사이드 스타일 커뮤니티 (현재 탭 + 최소 구현)

export default function BoardAdminPage() {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] p-12 text-center"
      style={{ minHeight: "calc(100vh - 220px)" }}
    >
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
        게시판
      </h2>
      <p className="text-sm text-[var(--color-text-muted)] max-w-md">
        디시인사이드 같은 커뮤니티 게시판 기능은 준비 중입니다.
        <br />
        탭과 최소 구조만 먼저 적용되어 있습니다.
      </p>
    </div>
  );
}
