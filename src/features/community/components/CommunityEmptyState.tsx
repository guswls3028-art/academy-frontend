// PATH: src/features/community/components/CommunityEmptyState.tsx
// Rich empty states for community domain — replaces plain text empty blocks

import EmptyState from "@/shared/ui/ds/EmptyState";

type CommunityEmptyVariant =
  | "no-scope"
  | "no-selection"
  | "no-results"
  | "no-posts"
  | "loading"
  | "error";

type PostTypeHint = "notice" | "board" | "materials" | "qna" | "counsel";

type CommunityEmptyStateProps = {
  variant: CommunityEmptyVariant;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  postType?: PostTypeHint;
  showKeyboardHint?: boolean;
};

const POST_TYPE_LABEL: Record<PostTypeHint, string> = {
  notice: "공지",
  board: "게시물",
  materials: "자료",
  qna: "질문",
  counsel: "상담 신청",
};

function defaults(
  variant: CommunityEmptyVariant,
  postType?: PostTypeHint,
): { title: string; description?: string } {
  const label = postType ? POST_TYPE_LABEL[postType] : "항목";

  switch (variant) {
    case "no-scope":
      return {
        title: "조회 범위를 선택하세요",
        description: "좌측 트리에서 전체 보기 또는 강의/차시를 선택하면\n해당 범위의 목록이 표시됩니다.",
      };
    case "no-selection":
      return {
        title: `${label}을(를) 선택하세요`,
        description: `왼쪽 목록에서 ${label}을(를) 클릭하면 내용이 표시됩니다.`,
      };
    case "no-results":
      return {
        title: "검색 결과가 없습니다",
        description: "다른 검색어를 입력해 보세요.",
      };
    case "no-posts":
      return {
        title: `${label}이(가) 없습니다`,
        description: `아직 등록된 ${label}이(가) 없습니다.`,
      };
    case "loading":
      return { title: "불러오는 중…" };
    case "error":
      return {
        title: "불러오지 못했습니다",
        description: "잠시 후 다시 시도해 주세요.",
      };
  }
}

export default function CommunityEmptyState({
  variant,
  title,
  description,
  action,
  postType,
  showKeyboardHint,
}: CommunityEmptyStateProps) {
  const d = defaults(variant, postType);
  const tone = variant === "error" ? "error" as const : variant === "loading" ? "loading" as const : "empty" as const;

  const keyboardHint = showKeyboardHint ? (
    <span className="qna-inbox__keyboard-hint">
      <kbd>j</kbd> 다음 · <kbd>k</kbd> 이전
    </span>
  ) : null;

  return (
    <div className="qna-inbox__empty">
      <EmptyState
        title={title ?? d.title}
        description={description ?? d.description}
        tone={tone}
        scope="panel"
        mode="embedded"
        actions={action}
        extra={keyboardHint}
      />
    </div>
  );
}
