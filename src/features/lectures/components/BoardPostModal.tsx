// PATH: src/features/lectures/components/BoardPostModal.tsx
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BoardCategory, createBoardPost } from "../api/board";

import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";

interface Props {
  lectureId: number;
  category: BoardCategory;
  onClose: () => void;
}

export default function BoardPostModal({ lectureId, category, onClose }: Props) {
  const qc = useQueryClient();

  const [titleInput, setTitleInput] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [busy, setBusy] = useState(false);

  const title = useMemo(() => `${category.name} - 글 작성`, [category.name]);

  const { mutate } = useMutation({
    mutationFn: async () => {
      setBusy(true);
      try {
        const fd = new FormData();
        fd.append("lecture", String(lectureId));
        fd.append("category", String(category.id));
        fd.append("title", titleInput);
        fd.append("content", content);
        if (files) Array.from(files).forEach((file) => fd.append("files", file));
        return await createBoardPost(fd);
      } finally {
        setBusy(false);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board-posts", lectureId, category.id] });
      onClose();
    },
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (!busy && titleInput.trim()) mutate();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, titleInput, content, files]);

  return (
    <AdminModal open={true} onClose={onClose} type="action" width={980}>
      <ModalHeader type="action" title={title} description="⌘/Ctrl + Enter 로 등록" />

      <ModalBody>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--color-text-secondary)" }}>
              제목
            </div>
            <input
              className="ds-input"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              disabled={busy}
              data-invalid={!titleInput.trim() ? "true" : "false"}
              autoFocus
            />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--color-text-secondary)" }}>
              내용
            </div>
            <textarea
              className="ds-textarea"
              rows={14}
              style={{ resize: "none" }}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={busy}
            />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--color-text-secondary)" }}>
              첨부 파일
            </div>
            <input type="file" multiple onChange={(e) => setFiles(e.target.files)} disabled={busy} />
            <div style={{ fontSize: 11, fontWeight: 850, color: "var(--color-text-muted)" }}>
              파일을 여러 개 선택할 수 있습니다.
            </div>
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        left={
          <span style={{ fontSize: 12, fontWeight: 850, color: "var(--color-text-muted)" }}>
            ESC 로 닫기 · ⌘/Ctrl + Enter 등록
          </span>
        }
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={busy}>
              취소
            </Button>
            <Button
              intent="primary"
              onClick={() => {
                if (!titleInput.trim()) return;
                mutate();
              }}
              disabled={busy || !titleInput.trim()}
            >
              {busy ? "저장 중…" : "등록"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
