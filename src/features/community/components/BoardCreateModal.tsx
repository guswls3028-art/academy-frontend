// PATH: src/features/community/components/BoardCreateModal.tsx
// 게시판 새 게시물 작성 모달 — 유형 선택 + 노출 강의 체크박스 + 제목 + 내용

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchScopeNodes,
  createPost,
  type BlockType,
  type ScopeNodeMinimal,
} from "../api/community.api";
import { Button } from "@/shared/ui/ds";

interface Props {
  blockTypes: BlockType[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function BoardCreateModal({ blockTypes, onClose, onSuccess }: Props) {
  // 유형 기본값 비움. 이전엔 blockTypes[0] 사용 → API 정렬에 따라 QnA가 첫 번째면 항상 QnA가 기본으로 잡혀 구조적 문제 발생.
  const [blockTypeId, setBlockTypeId] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedNodeIds, setSelectedNodeIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopeNodesQ = useQuery<ScopeNodeMinimal[]>({
    queryKey: ["community-scope-nodes"],
    queryFn: fetchScopeNodes,
  });

  const courseNodes = useMemo(
    () => (scopeNodesQ.data ?? []).filter((n) => n.level === "COURSE"),
    [scopeNodesQ.data]
  );

  const allSelected = courseNodes.length > 0 && selectedNodeIds.length === courseNodes.length;

  const toggleNode = (id: number) => {
    setSelectedNodeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedNodeIds(allSelected ? [] : courseNodes.map((n) => n.id));
  };

  const canSubmit =
    blockTypeId !== "" &&
    title.trim().length > 0 &&
    selectedNodeIds.length > 0 &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createPost({
        block_type: Number(blockTypeId),
        title: title.trim(),
        content: content.trim(),
        node_ids: selectedNodeIds,
      });
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="board-create-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--color-bg-surface)",
          borderRadius: "var(--radius-xl)",
          padding: "var(--space-6)",
          maxWidth: 520,
          width: "92%",
          boxShadow: "var(--elevation-3)",
          maxHeight: "90vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="board-create-title"
          style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--color-text-primary)" }}
        >
          새 게시물
        </h3>

        {/* Block type */}
        <div>
          <label className="board-create__label">
            유형 <span style={{ color: "var(--color-danger)" }}>*</span>
          </label>
          <select
            className="ds-input"
            value={blockTypeId}
            onChange={(e) =>
              setBlockTypeId(e.target.value === "" ? "" : Number(e.target.value))
            }
            style={{ width: "100%" }}
          >
            <option value="">선택하세요</option>
            {blockTypes.map((bt) => (
              <option key={bt.id} value={bt.id}>
                {bt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="board-create__label">
            제목 <span style={{ color: "var(--color-danger)" }}>*</span>
          </label>
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
        <div>
          <label className="board-create__label">내용</label>
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
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <label className="board-create__label" style={{ margin: 0 }}>
              노출 강의 <span style={{ color: "var(--color-danger)" }}>*</span>
            </label>
            {courseNodes.length > 1 && (
              <button
                type="button"
                style={{
                  fontSize: 12,
                  color: "var(--color-primary)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
                onClick={toggleAll}
              >
                {allSelected ? "전체 해제" : "전체 선택"}
              </button>
            )}
          </div>

          {scopeNodesQ.isLoading ? (
            <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              강의 목록 불러오는 중…
            </p>
          ) : courseNodes.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              등록된 강의가 없습니다.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                maxHeight: 160,
                overflowY: "auto",
                border: "1px solid var(--color-border-divider)",
                borderRadius: 8,
                padding: "8px 12px",
                background: "var(--color-bg-surface-soft)",
              }}
            >
              {courseNodes.map((n) => (
                <label
                  key={n.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    cursor: "pointer",
                    padding: "4px 0",
                    color: "var(--color-text-primary)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedNodeIds.includes(n.id)}
                    onChange={() => toggleNode(n.id)}
                    style={{ width: 14, height: 14, accentColor: "var(--color-primary)" }}
                  />
                  {n.lecture_title}
                </label>
              ))}
            </div>
          )}
          {selectedNodeIds.length > 0 && (
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
              {selectedNodeIds.length}개 강의 선택됨
            </p>
          )}
        </div>

        {error && (
          <p style={{ fontSize: 13, color: "var(--color-danger)", margin: 0 }}>{error}</p>
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
