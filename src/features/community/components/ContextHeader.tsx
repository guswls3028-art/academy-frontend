// PATH: src/features/community/components/ContextHeader.tsx
// 상단 컨텍스트 바 — 현재 조회 범위를 항상 표시
import type { CommunityScope } from "../api/community.api";

type Props = {
  /** 탭 이름: 공지사항, 게시판, 자료실, QnA, 상담 신청 */
  tabLabel: string;
  scope: CommunityScope;
  lectureName?: string | null;
  sessionName?: string | null;
  /** 추가 정보 (예: "답변 대기 3건") */
  extra?: string;
};

export default function ContextHeader({
  tabLabel,
  scope,
  lectureName,
  sessionName,
  extra,
}: Props) {
  let scopeLabel: string;
  if (scope === "all") {
    scopeLabel = "전체 보기";
  } else if (scope === "session" && lectureName && sessionName) {
    scopeLabel = `차시 대상 · ${lectureName} > ${sessionName}`;
  } else if (scope === "lecture" && lectureName) {
    scopeLabel = `강의 대상 · ${lectureName}`;
  } else {
    scopeLabel = "전체 보기";
  }

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border-divider)] bg-[var(--color-bg-surface)]"
      style={{ minHeight: 36 }}
    >
      <span className="text-sm font-semibold text-[var(--color-text-primary)]">{tabLabel}</span>
      <span className="text-xs text-[var(--color-text-muted)]">·</span>
      <span className="text-xs text-[var(--color-text-muted)]">{scopeLabel}</span>
      {extra && (
        <>
          <span className="text-xs text-[var(--color-text-muted)]">·</span>
          <span className="text-xs font-medium text-[var(--color-brand-primary)]">{extra}</span>
        </>
      )}
    </div>
  );
}
