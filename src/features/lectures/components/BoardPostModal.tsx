// PATH: src/features/lectures/components/BoardPostModal.tsx
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BoardCategory, createBoardPost, getCourseNodeIdForLecture } from "../api/board";
import { createPostTemplate, type PostTemplate } from "@/features/community/api/community.api";

import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";

interface Props {
  lectureId: number;
  category: BoardCategory;
  templates?: PostTemplate[];
  onClose: () => void;
}

export default function BoardPostModal({ lectureId, category, templates = [], onClose }: Props) {
  const qc = useQueryClient();

  const [titleInput, setTitleInput] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const loadTemplate = (t: PostTemplate) => {
    setTitleInput(t.title ?? "");
    setContent(t.content ?? "");
  };

  const saveAsTemplateMut = useMutation({
    mutationFn: () =>
      createPostTemplate({
        name: templateName.trim(),
        block_type: category.id,
        title: titleInput.trim() || undefined,
        content: content.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-post-templates"] });
      setShowSaveAsTemplate(false);
      setTemplateName("");
    },
  });

  const title = useMemo(
    () => `${"label" in category ? category.label : (category as { name?: string }).name ?? "글"} - 글 작성`,
    [category]
  );

  const { mutate } = useMutation({
    mutationFn: async () => {
      setBusy(true);
      try {
        const nodeId = await getCourseNodeIdForLecture(lectureId);
        if (nodeId == null) throw new Error("이 강의에 대한 노드를 찾을 수 없습니다.");
        return await createBoardPost({
          block_type: category.id,
          title: titleInput.trim(),
          content: content.trim(),
          node_ids: [nodeId],
        });
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
  }, [busy, titleInput, content]);

  return (
    <AdminModal open={true} onClose={onClose} type="action" width={980}>
      <ModalHeader type="action" title={title} description="⌘/Ctrl + Enter 로 등록" />

      <ModalBody>
        <div style={{ display: "grid", gap: 12 }}>
          {templates.length > 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "var(--color-text-secondary)" }}>
                양식에서 불러오기
              </div>
              <select
                className="ds-input"
                value=""
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : 0;
                  const t = templates.find((x) => x.id === id);
                  if (t) loadTemplate(t);
                  e.target.value = "";
                }}
              >
                <option value="">선택하세요</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.block_type_label ? ` (${t.block_type_label})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
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

          {/* 첨부파일은 community API 미지원 — 추후 확장 시 추가 */}
        </div>
      </ModalBody>

      <ModalFooter
        left={
          <div className="flex items-center gap-2">
            {(titleInput.trim() || content.trim()) && (
              <Button
                intent="ghost"
                size="sm"
                onClick={() => setShowSaveAsTemplate(true)}
              >
                현재 내용을 양식으로 저장
              </Button>
            )}
            <span style={{ fontSize: 12, fontWeight: 850, color: "var(--color-text-muted)" }}>
              ESC 로 닫기 · ⌘/Ctrl + Enter 등록
            </span>
          </div>
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

      {showSaveAsTemplate && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
          }}
          onClick={() => !saveAsTemplateMut.isPending && setShowSaveAsTemplate(false)}
        >
          <div
            style={{
              background: "var(--color-bg-surface)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-5)",
              minWidth: 320,
              boxShadow: "var(--elevation-3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ marginBottom: 12, fontSize: 16, fontWeight: 700 }}>양식으로 저장</h4>
            <input
              className="ds-input"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="양식 이름 (예: 중간고사 공지)"
              style={{ width: "100%", marginBottom: 16 }}
              disabled={saveAsTemplateMut.isPending}
            />
            <div className="flex gap-2 justify-end">
              <Button
                intent="secondary"
                size="sm"
                onClick={() => setShowSaveAsTemplate(false)}
                disabled={saveAsTemplateMut.isPending}
              >
                취소
              </Button>
              <Button
                intent="primary"
                size="sm"
                onClick={() => templateName.trim() && saveAsTemplateMut.mutate()}
                disabled={!templateName.trim() || saveAsTemplateMut.isPending}
              >
                {saveAsTemplateMut.isPending ? "저장 중…" : "저장"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminModal>
  );
}
