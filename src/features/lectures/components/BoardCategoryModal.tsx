import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createBoardCategory } from "../api/board";

interface Props {
  lectureId: number;
  onClose: () => void;
}

export default function BoardCategoryModal({ lectureId, onClose }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const { mutate, isLoading } = useMutation({
    mutationFn: () => createBoardCategory({ lecture: lectureId, name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board-categories", lectureId] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-lg bg-[var(--bg-surface)] p-5 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
          게시판 카테고리 추가
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="
              w-full rounded-md px-3 py-2 text-sm
              border border-[var(--border-divider)]
              bg-[var(--bg-app)]
              text-[var(--text-primary)]
            "
            placeholder="예: 오탈자 및 정정사항"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="flex justify-end gap-2 text-sm">
            <button
              type="button"
              onClick={onClose}
              className="
                rounded-md px-3 py-2
                border border-[var(--border-divider)]
                text-[var(--text-secondary)]
                hover:bg-[var(--bg-surface-soft)]
              "
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="
                rounded-md px-3 py-2
                bg-[var(--color-primary)]
                text-white
                disabled:opacity-60
              "
            >
              {isLoading ? "저장 중..." : "추가"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
