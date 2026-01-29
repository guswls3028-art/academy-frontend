import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createMaterialCategory } from "../api/materials";

interface Props {
  lectureId: number;
  onClose: () => void;
}

export default function MaterialCategoryModal({ lectureId, onClose }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const { mutate, isLoading } = useMutation({
    mutationFn: () => createMaterialCategory({ lecture: lectureId, name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material-categories", lectureId] });
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
          자료실 카테고리 추가
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="
              w-full rounded-md px-3 py-2 text-sm
              border border-[var(--border-divider)]
              bg-[var(--bg-app)]
              text-[var(--text-primary)]
            "
            placeholder="예: 숙제, 시험, 복습 과제..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="flex justify-end gap-2 text-sm">
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
              className="rounded-md bg-[var(--color-primary)] px-3 py-2 text-white disabled:opacity-60"
            >
              {isLoading ? "저장 중..." : "추가"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
