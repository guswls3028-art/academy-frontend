// PATH: src/features/community/components/CommunityEmptyState.tsx
// Rich empty states for community domain — premium SaaS quality

import { Inbox, Search, AlertTriangle, Loader2, MousePointerClick, FolderSearch } from "lucide-react";

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

// Natural Korean particles per post type (을/를, 이/가 handled correctly)
const POST_TYPE_SELECT: Record<PostTypeHint | "_default", string> = {
  notice: "공지사항을 선택하세요",
  board: "게시물을 선택하세요",
  materials: "자료를 선택하세요",
  qna: "질문을 선택하세요",
  counsel: "상담을 선택하세요",
  _default: "항목을 선택하세요",
};

const POST_TYPE_CLICK: Record<PostTypeHint | "_default", string> = {
  notice: "왼쪽 목록에서 공지사항을 클릭하면 내용이 표시됩니다.",
  board: "왼쪽 목록에서 게시물을 클릭하면 내용이 표시됩니다.",
  materials: "왼쪽 목록에서 자료를 클릭하면 내용이 표시됩니다.",
  qna: "왼쪽 목록에서 질문을 클릭하면 내용이 표시됩니다.",
  counsel: "왼쪽 목록에서 상담을 클릭하면 내용이 표시됩니다.",
  _default: "왼쪽 목록에서 항목을 클릭하면 내용이 표시됩니다.",
};

const POST_TYPE_EMPTY: Record<PostTypeHint | "_default", string> = {
  notice: "공지사항이 없습니다",
  board: "게시물이 없습니다",
  materials: "자료가 없습니다",
  qna: "질문이 없습니다",
  counsel: "상담이 없습니다",
  _default: "항목이 없습니다",
};

function defaults(
  variant: CommunityEmptyVariant,
  postType?: PostTypeHint
): { title: string; description?: string } {
  const key = postType ?? "_default";

  switch (variant) {
    case "no-scope":
      return {
        title: "조회 범위를 선택하세요",
        description:
          "좌측 트리에서 전체 보기 또는 강의/차시를 선택하면\n해당 범위의 목록이 표시됩니다.",
      };
    case "no-selection":
      return {
        title: POST_TYPE_SELECT[key],
        description: POST_TYPE_CLICK[key],
      };
    case "no-results":
      return {
        title: "검색 결과가 없습니다",
        description: "다른 검색어를 입력해 보세요.",
      };
    case "no-posts":
      return {
        title: POST_TYPE_EMPTY[key],
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

const VARIANT_ICON: Record<CommunityEmptyVariant, React.ComponentType<{ size?: number; className?: string }>> = {
  "no-scope": FolderSearch,
  "no-selection": MousePointerClick,
  "no-results": Search,
  "no-posts": Inbox,
  loading: Loader2,
  error: AlertTriangle,
};

export default function CommunityEmptyState({
  variant,
  title,
  description,
  action,
  postType,
  showKeyboardHint,
}: CommunityEmptyStateProps) {
  const d = defaults(variant, postType);
  const IconComp = VARIANT_ICON[variant];
  const isLoading = variant === "loading";
  const isError = variant === "error";

  const keyboardHint = showKeyboardHint ? (
    <span className="qna-inbox__keyboard-hint">
      <kbd>j</kbd> 다음 · <kbd>k</kbd> 이전
    </span>
  ) : null;

  return (
    <div className="qna-inbox__empty">
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: isError
            ? "color-mix(in srgb, var(--color-error) 10%, transparent)"
            : "color-mix(in srgb, var(--color-primary) 8%, transparent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: isError
            ? "var(--color-error)"
            : "var(--color-primary)",
          marginBottom: 4,
        }}
      >
        <IconComp
          size={24}
          className={isLoading ? "community-empty__spinner" : undefined}
        />
      </div>
      <p className="qna-inbox__empty-title">{title ?? d.title}</p>
      {(description ?? d.description) && (
        <p className="qna-inbox__empty-desc">
          {description ?? d.description}
        </p>
      )}
      {action}
      {keyboardHint}
    </div>
  );
}
