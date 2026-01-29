import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createMaterial } from "../api/materials";

interface Props {
  lectureId: number;
  categoryId: number | null;
  onClose: () => void;
}

export default function MaterialUploadModal({
  lectureId,
  categoryId,
  onClose,
}: Props) {
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");

  const { mutate, isLoading } = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("lecture", String(lectureId));
      if (categoryId) fd.append("category", String(categoryId));
      fd.append("title", title || (file ? file.name : "자료"));
      fd.append("description", description);
      if (file) fd.append("file", file);
      if (url) fd.append("url", url);
      fd.append("is_public", "true");
      return createMaterial(fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["materials", lectureId, categoryId ?? "all"],
      });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !url.trim()) return;
    mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-lg bg-[var(--bg-surface)] p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
          자료 추가하기
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
              설명
            </label>
            <textarea
              className="h-20 w-full resize-none rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="mb-1 block font-medium text-[var(--text-secondary)]">
                파일 업로드
              </label>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="flex-1">
              <label className="mb-1 block font-medium text-[var(--text-secondary)]">
                외부 URL
              </label>
              <input
                className="w-full rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 py-2"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
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
              {isLoading ? "저장 중..." : "추가"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
