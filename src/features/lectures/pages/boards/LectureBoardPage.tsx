// src/features/lectures/pages/boards/LectureBoardPage.tsx

import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  BoardCategory,
  BoardPost,
  fetchBoardCategories,
  fetchBoardPosts,
} from "../../api/board";

import BoardCategoryModal from "../../components/BoardCategoryModal";
import BoardPostModal from "../../components/BoardPostModal";
import BoardPostDetail from "../../components/BoardPostDetail";

import { PageHeader, Section, Panel, EmptyState } from "@/shared/ui/ds";

export default function LectureBoardPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const lectureIdNum = Number(lectureId);

  const [selectedCategory, setSelectedCategory] =
    useState<BoardCategory | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [openedPost, setOpenedPost] = useState<BoardPost | null>(null);

  const { data: categories = [] } = useQuery<BoardCategory[]>({
    queryKey: ["board-categories", lectureIdNum],
    queryFn: () => fetchBoardCategories(lectureIdNum),
    enabled: Number.isFinite(lectureIdNum),
    onSuccess: (data) => {
      if (!selectedCategory && data.length > 0) {
        setSelectedCategory(data[0]);
      }
    },
  });

  const { data: posts = [] } = useQuery<BoardPost[]>({
    queryKey: [
      "board-posts",
      lectureIdNum,
      selectedCategory?.id ?? "none",
    ],
    queryFn: () =>
      fetchBoardPosts({
        lecture: lectureIdNum,
        category: selectedCategory?.id,
      }),
    enabled: Number.isFinite(lectureIdNum) && !!selectedCategory,
  });

  return (
    <Section>
      <PageHeader
        title="강의 게시판"
        actions={
          selectedCategory && (
            <button
              onClick={() => setShowPostModal(true)}
              className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm text-white"
            >
              글 작성
            </button>
          )
        }
      />

      <Panel>
        <div className="flex gap-6">
          <div
            className="
              w-60 shrink-0
              rounded-xl border border-[var(--border-divider)]
              bg-[var(--bg-surface)]
              p-4 text-sm
            "
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                게시판 목록
              </span>
              <button
                onClick={() => setShowCategoryModal(true)}
                className="text-xs font-medium text-[var(--color-primary)] hover:underline"
              >
                + 추가
              </button>
            </div>

            <ul className="space-y-1">
              {categories.map((cat) => (
                <li key={cat.id}>
                  <button
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full rounded-md px-3 py-2 text-left ${
                      selectedCategory?.id === cat.id
                        ? "bg-[var(--bg-surface-soft)] font-semibold text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]"
                    }`}
                  >
                    {cat.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div
            className="
              flex-1
              rounded-xl border border-[var(--border-divider)]
              bg-[var(--bg-surface)]
              p-6
            "
          >
            {!selectedCategory || posts.length === 0 ? (
              <EmptyState
                title="등록된 글이 없습니다."
                description="게시글을 작성하면 여기에 표시됩니다."
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-[var(--border-divider)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--bg-surface-soft)]">
                    <tr>
                      <th className="px-4 py-2 text-left">제목</th>
                      <th className="px-4 py-2 text-left">작성일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => setOpenedPost(p)}
                        className="
                          cursor-pointer
                          border-t border-[var(--border-divider)]
                          hover:bg-[var(--bg-surface-soft)]
                        "
                      >
                        <td className="px-4 py-2 font-medium">
                          {p.title}
                        </td>
                        <td className="px-4 py-2 text-[var(--text-muted)]">
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
      </Panel>

      {showCategoryModal && (
        <BoardCategoryModal
          lectureId={lectureIdNum}
          onClose={() => setShowCategoryModal(false)}
        />
      )}

      {showPostModal && selectedCategory && (
        <BoardPostModal
          lectureId={lectureIdNum}
          category={selectedCategory}
          onClose={() => setShowPostModal(false)}
        />
      )}

      {openedPost && (
        <BoardPostDetail
          lectureId={lectureIdNum}
          post={openedPost}
          onClose={() => setOpenedPost(null)}
        />
      )}
    </Section>
  );
}
