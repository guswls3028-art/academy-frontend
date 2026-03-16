// PATH: src/features/community/components/NoticeAdminCreateModal.tsx
// 공지사항 관리 전용 작성 모달 — 유형 선택 없음(항상 공지), 노출 범위만 선택

import { useState, useMemo } from "react";
import {
  createPost,
  uploadPostAttachments,
  type ScopeNodeMinimal,
  type CommunityScopeParams,
} from "../api/community.api";
import { Button } from "@/shared/ui/ds";
import { useModalKeyboard } from "@/shared/ui/modal";
import { feedback } from "@/shared/ui/feedback/feedback";
import RichTextEditor from "@/shared/ui/editor/RichTextEditor";
import "@/features/community/community.css";

export type NoticeScope = "all" | "lecture" | "session";

export interface NoticeAdminCreateModalProps {
  scope: NoticeScope;
  scopeNodes: ScopeNodeMinimal[];
  scopeParams: CommunityScopeParams;
  effectiveLectureId?: number;
  sessionId?: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function NoticeAdminCreateModal({
  scope,
  scopeNodes,
  effectiveLectureId,
  sessionId,
  onClose,
  onSuccess,
}: NoticeAdminCreateModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [selectedExposureNodeId, setSelectedExposureNodeId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = { current: null as HTMLInputElement | null };

  const exposureNodeIds = useMemo(() => {
    if (scope === "lecture" && effectiveLectureId != null) {
      const n = scopeNodes.find((x) => x.lecture === effectiveLectureId && x.session == null);
      return n ? [n.id] : [];
    }
    if (scope === "session" && effectiveLectureId != null && sessionId != null) {
      const n = scopeNodes.find(
        (x) => x.lecture === effectiveLectureId && Number(x.session) === sessionId
      );
      return n ? [n.id] : [];
    }
    if (scope === "all" && selectedExposureNodeId != null) {
      return [selectedExposureNodeId];
    }
    return [];
  }, [scope, scopeNodes, effectiveLectureId, sessionId, selectedExposureNodeId]);

  const courseNodes = useMemo(
    () => scopeNodes.filter((n) => n.level === "COURSE"),
    [scopeNodes]
  );

  const canSubmit =
    title.trim().length > 0 &&
    exposureNodeIds.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const post = await createPost({
        post_type: "notice",
        title: title.trim(),
        content: content.trim(),
        node_ids: exposureNodeIds,
      });
      if (files.length > 0) {
        await uploadPostAttachments(post.id, files);
      }
      onSuccess();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      const message =
        err?.response?.data?.detail ?? err?.message ?? "공지 등록에 실패했습니다.";
      feedback.error(message);
      setIsSubmitting(false);
    }
  };

  useModalKeyboard(true, onClose, canSubmit && !isSubmitting ? handleSubmit : undefined);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notice-admin-create-title"
      className="community-modal-overlay"
      onClick={onClose}
    >
      <div
        className="community-modal-dialog community-modal-dialog--narrow"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="notice-admin-create-title" className="community-modal-title">
          공지 작성
        </h3>

        {(scope === "lecture" || scope === "session") && exposureNodeIds.length === 0 && (
          <p
            role="alert"
            className="community-field__hint"
            style={{
              padding: "var(--space-3)",
              background: "var(--color-bg-surface-soft, var(--bg-surface-soft))",
              borderRadius: "var(--radius-md)",
            }}
          >
            노출 범위를 찾을 수 없습니다. 좌측 트리에서 강의/차시를 다시 선택해 주세요.
          </p>
        )}

        {scope === "all" && (
          <div className="community-field">
            <label htmlFor="notice-exposure-node" className="community-field__label">
              노출 위치(강의)
            </label>
            <select
              id="notice-exposure-node"
              className="ds-input"
              value={selectedExposureNodeId ?? ""}
              onChange={(e) =>
                setSelectedExposureNodeId(e.target.value ? Number(e.target.value) : null)
              }
              style={{ width: "100%" }}
              aria-required
            >
              <option value="">선택하세요</option>
              {courseNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.lecture_title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="community-field">
          <label htmlFor="notice-title" className="community-field__label">제목</label>
          <input
            id="notice-title"
            className="ds-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="공지 제목"
            style={{ width: "100%" }}
            aria-required
          />
        </div>

        <div className="community-field">
          <label className="community-field__label">내용 (선택)</label>
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="공지 내용을 입력하세요. 등록 후에도 수정할 수 있습니다."
            minHeight={180}
          />
        </div>

        <div className="community-field">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <label className="community-field__label" style={{ margin: 0 }}>
              첨부파일 {files.length > 0 && `(${files.length}/10)`}
            </label>
            <Button intent="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={files.length >= 10}>
              + 파일 추가
            </Button>
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
                <div key={`${f.name}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--color-bg-surface-soft, #f5f5f5)", borderRadius: "var(--radius-sm, 6px)", fontSize: 13 }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <span style={{ fontSize: 11, color: "var(--color-text-muted)", flexShrink: 0 }}>{f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(1)}KB` : `${(f.size / (1024 * 1024)).toFixed(1)}MB`}</span>
                  <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 2, color: "var(--color-text-muted)" }}>&times;</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button intent="secondary" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button
            intent="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? "등록 중…" : "등록"}
          </Button>
        </div>
      </div>
    </div>
  );
}
