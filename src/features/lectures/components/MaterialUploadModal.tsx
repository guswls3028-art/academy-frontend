// PATH: src/features/lectures/components/MaterialUploadModal.tsx
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createMaterial } from "../api/materials";

import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";

interface Props {
  lectureId: number;
  categoryId: number | null;
  onClose: () => void;
}

export default function MaterialUploadModal({ lectureId, categoryId, onClose }: Props) {
  const qc = useQueryClient();

  const [titleInput, setTitleInput] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const title = useMemo(() => "자료 추가하기", []);

  const { mutate } = useMutation({
    mutationFn: async () => {
      setBusy(true);
      try {
        const fd = new FormData();
        fd.append("lecture", String(lectureId));
        if (categoryId) fd.append("category", String(categoryId));
        fd.append("title", titleInput || (file ? file.name : "자료"));
        fd.append("description", description);
        if (file) fd.append("file", file);
        if (url) fd.append("url", url);
        fd.append("is_public", "true");
        return await createMaterial(fd);
      } finally {
        setBusy(false);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials", lectureId, categoryId ?? "all"] });
      onClose();
    },
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (!busy && (file || url.trim())) mutate();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, file, url, titleInput, description]);

  return (
    <AdminModal open={true} onClose={onClose} type="action" width={920}>
      <ModalHeader type="action" title={title} description="⌘/Ctrl + Enter 로 추가" />

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
              placeholder="미입력 시 파일명/기본값 사용"
            />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--color-text-secondary)" }}>
              설명
            </div>
            <textarea
              className="ds-textarea"
              rows={4}
              style={{ resize: "none" }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "var(--color-text-secondary)" }}>
                파일 업로드
              </div>
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={busy} />
              <div style={{ fontSize: 11, fontWeight: 850, color: "var(--color-text-muted)" }}>
                파일 또는 URL 중 하나 이상 필요합니다.
              </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "var(--color-text-secondary)" }}>
                외부 URL
              </div>
              <input
                className="ds-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={busy}
                placeholder="https://"
              />
            </div>
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        left={
          <span style={{ fontSize: 12, fontWeight: 850, color: "var(--color-text-muted)" }}>
            ESC 로 닫기 · ⌘/Ctrl + Enter 추가
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
                if (!file && !url.trim()) return;
                mutate();
              }}
              disabled={busy || (!file && !url.trim())}
            >
              {busy ? "저장 중…" : "추가"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
