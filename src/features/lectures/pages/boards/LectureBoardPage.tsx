// PATH: src/features/lectures/pages/boards/LectureBoardPage.tsx
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { BoardPost, fetchBoardPosts } from "../../api/board";
import { fetchPostTemplates, type PostTemplate } from "@/features/community/api/community.api";
import BoardPostModal from "../../components/BoardPostModal";
import BoardPostDetail from "../../components/BoardPostDetail";
import { EmptyState, Button } from "@/shared/ui/ds";

const TH_STYLE = {
  background: "color-mix(in srgb, var(--color-primary) 12%, var(--bg-surface))",
  color: "var(--color-text-muted)",
};

export default function LectureBoardPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const lectureIdNum = Number(lectureId);

  const [showPostModal, setShowPostModal] = useState(false);
  const [openedPost, setOpenedPost] = useState<BoardPost | null>(null);

  const { data: posts = [], isLoading: loadingPosts } = useQuery<BoardPost[]>({
    queryKey: ["board-posts", lectureIdNum],
    queryFn: () =>
      fetchBoardPosts({
        lecture: lectureIdNum,
      }),
    enabled: Number.isFinite(lectureIdNum),
  });

  const { data: templates = [] } = useQuery<PostTemplate[]>({
    queryKey: ["community-post-templates"],
    queryFn: () => fetchPostTemplates(),
    enabled: showPostModal,
  });


  return (
    <>
      {/* 액션바 — 블록 타입은 읽기 전용 */}
      <div className="flex items-center gap-2 mb-3">
        <Button intent="primary" onClick={() => setShowPostModal(true)}>
          글 작성
        </Button>

        <span className="ml-auto text-sm font-semibold text-[var(--color-text-muted)]">
          {loadingPosts ? "불러오는 중…" : `${posts.length}개`}
        </span>
      </div>

      <div>
        <div
          style={{
            borderRadius: 18,
            border: "1px solid var(--color-border-divider)",
            background: "var(--color-bg-surface)",
            padding: 12,
            overflow: "hidden",
          }}
        >
          <div className="flex items-baseline justify-between mb-2">
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--color-text-secondary)" }}>
              게시글
            </div>
            <div style={{ fontSize: 11, fontWeight: 850, color: "var(--color-text-muted)" }}>
              {loadingPosts ? "불러오는 중…" : `${posts.length}개`}
            </div>
          </div>

          {loadingPosts ? (
            <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
          ) : posts.length === 0 ? (
            <EmptyState scope="panel" tone="empty" title="등록된 글이 없습니다." description="게시글을 작성하면 여기에 표시됩니다." />
          ) : (
            <div style={{ overflow: "hidden", borderRadius: 14, border: "1px solid var(--color-border-divider)" }}>
              <table className="w-full" style={{ tableLayout: "fixed" }}>
                <thead>
                  <tr>
                    <th
                      className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
                      style={{ textAlign: "left", whiteSpace: "nowrap", ...TH_STYLE }}
                    >
                      제목
                    </th>
                    <th
                      className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
                      style={{ textAlign: "center", whiteSpace: "nowrap", width: 140, ...TH_STYLE }}
                    >
                      작성일
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-divider)]">
                  {posts.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setOpenedPost(p)}
                      tabIndex={0}
                      role="button"
                      className="cursor-pointer hover:bg-[var(--color-bg-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]/40"
                    >
                      <td className="px-4 py-3 text-left text-[15px] font-bold text-[var(--color-text-primary)] truncate">
                        {p.title}
                      </td>
                      <td className="px-4 py-3 text-center text-[13px] font-semibold text-[var(--color-text-muted)] truncate">
                        {p.created_at.slice(0, 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showPostModal && (
        <BoardPostModal
          lectureId={lectureIdNum}
          categoryLabel="게시판"
          templates={templates}
          onClose={() => setShowPostModal(false)}
        />
      )}
      {openedPost && <BoardPostDetail lectureId={lectureIdNum} post={openedPost} onClose={() => setOpenedPost(null)} />}
    </>
  );
}
