// PATH: src/features/community/components/BoardCreateModal.tsx
// 게시판 새 게시물 작성 모달 — 유형 선택 + 노출 강의 체크박스 + 제목 + 내용

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchScopeNodes,
  createPost,
  uploadPostAttachments,
  type ScopeNodeMinimal,
} from "../api/community.api";
import { Button } from "@/shared/ui/ds";
import { useModalKeyboard } from "@/shared/ui/modal";
import "@/features/community/community.css";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function BoardCreateModal({ onClose, onSuccess }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = { current: null as HTMLInputElement | null };

  const scopeNodesQ = useQuery<ScopeNodeMinimal[]>({
    queryKey: ["community-scope-nodes"],
    queryFn: fetchScopeNodes,
  });

  const courseNodes = useMemo(
    () => (scopeNodesQ.data ?? []).filter((n) => n.level === "COURSE"),
    [scopeNodesQ.data]
  );

  const allSelected = courseNodes.length > 0 && selectedNodeIds.length === courseNodes.length;

  const toggleNode = (nodeId: number) => {
    setSelectedNodeIds((prev) =>
      prev.includes(nodeId) ? prev.filter((x) => x !== nodeId) : [...prev, nodeId]
    );
  };

  const toggleAll = () => {
    setSelectedNodeIds(allSelected ? [] : courseNodes.map((n) => n.id));
  };

  const canSubmit =
    title.trim().length > 0 &&
    selectedNodeIds.length > 0 &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const post = await createPost({
        post_type: "board",
        title: title.trim(),
        content: content.trim(),
        node_ids: selectedNodeIds,
      });
      if (files.length > 0) {
        await uploadPostAttachments(post.id, files);
      }
      onSuccess();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (e as Error)?.message ??
        "등록에 실패했습니다.";
      setError(msg);
      setSubmitting(false);
    }
  };

  useModalKeyboard(true, onClose, canSubmit ? handleSubmit : undefined);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="board-create-title"
      className="community-modal-overlay"
      onClick={onClose}
    >
      <div
        className="community-modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="board-create-title" className="community-modal-title">
          새 게시물
        </h3>

        {/* Title */}
        <div className="community-field">
          <label className="community-field__label community-field__label--required">제목</label>
          <input
            className="ds-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="게시물 제목을 입력하세요"
            style={{ width: "100%" }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.form?.querySelector("textarea")?.focus();
            }}
          />
        </div>

        {/* Content */}
        <div className="community-field">
          <label className="community-field__label">내용</label>
          <textarea
            className="ds-input"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력하세요. (선택)"
            rows={5}
            style={{ width: "100%", resize: "vertical", minHeight: 100 }}
          />
        </div>

        {/* Scope nodes — COURSE level checkboxes */}
        <div className="community-field">
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <label className="community-field__label community-field__label--required" style={{ margin: 0 }}>
              노출 강의
            </label>
            {courseNodes.length > 1 && (
              <button
                type="button"
                className="community-link"
                style={{ fontSize: "var(--text-xs, 11px)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                onClick={toggleAll}
              >
                {allSelected ? "전체 해제" : "전체 선택"}
              </button>
            )}
          </div>

          {scopeNodesQ.isLoading ? (
            <p className="community-field__hint">강의 목록 불러오는 중…</p>
          ) : courseNodes.length === 0 ? (
            <p className="community-field__hint">등록된 강의가 없습니다.</p>
          ) : (
            <div className="community-checkbox-list">
              {courseNodes.map((n) => (
                <label key={n.id}>
                  <input
                    type="checkbox"
                    checked={selectedNodeIds.includes(n.id)}
                    onChange={() => toggleNode(n.id)}
                  />
                  {n.lecture_title}
                </label>
              ))}
            </div>
          )}
          {selectedNodeIds.length > 0 && (
            <p className="community-field__hint" style={{ marginTop: 4 }}>
              {selectedNodeIds.length}개 강의 선택됨
            </p>
          )}
        </div>

        {/* 첨부파일 */}
        <div className="community-field">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <label className="community-field__label" style={{ margin: 0 }}>
              첨부파일 {files.length > 0 && `(${files.length}/10)`}
            </label>
            <button
              type="button"
              className="community-link"
              style={{ fontSize: 11, background: "none", border: "none", cursor: "pointer", padding: 0 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={files.length >= 10}
            >
              + 파일 추가
            </button>
            <input
              ref={(el) => { fileInputRef.current = el; }}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files) {
                  setFiles((prev) => [...prev, ...Array.from(e.target.files!)].slice(0, 10));
                  e.target.value = "";
                }
              }}
            />
          </div>
          {files.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {files.map((f, i) => (
                <div key={`${f.name}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--color-bg-surface-soft, #f5f5f5)", borderRadius: 6, fontSize: 13 }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <span style={{ fontSize: 11, color: "var(--color-text-muted)", flexShrink: 0 }}>{f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(1)}KB` : `${(f.size / (1024 * 1024)).toFixed(1)}MB`}</span>
                  <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 2 }}>&times;</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p className="community-field__error">{error}</p>
        )}

        <div className="flex gap-2 justify-end" style={{ marginTop: 4 }}>
          <Button intent="secondary" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button intent="primary" size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "등록 중…" : "등록"}
          </Button>
        </div>
      </div>
    </div>
  );
}
