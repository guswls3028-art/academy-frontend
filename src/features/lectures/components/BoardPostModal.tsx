import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BoardCategory, createBoardPost } from "../api/board";

interface Props {
  lectureId: number;
  category: BoardCategory;
  onClose: () => void;
}

export default function BoardPostModal({ lectureId, category, onClose }: Props) {
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);

  const { mutate, isLoading } = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("lecture", String(lectureId));
      fd.append("category", String(category.id));
      fd.append("title", title);
      fd.append("content", content);
      if (files) {
        Array.from(files).forEach((file) => fd.append("files", file));
      }
      return createBoardPost(fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["board-posts", lectureId, category.id],
      });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-3xl rounded-lg bg-[var(--bg-surface)] p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
          {category.name} - 글 작성
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="mb-1 block font-medium text-[var(--text-secondary)]">
              제목
            </label>
            <input
              className="w-full rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-[var(--text-secondary)]">
              내용
            </label>
            <textarea
              className="h-60 w-full resize-none rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 py-2"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-[var(--text-secondary)]">
              첨부 파일
            </label>
            <input type="file" multiple onChange={(e) => setFiles(e.target.files)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[var(--border-divider)] px-3 py-2 text-[var(--text-secondary)]"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-white disabled:opacity-60"
            >
              {isLoading ? "저장 중..." : "등록"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
