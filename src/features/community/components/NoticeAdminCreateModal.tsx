// PATH: src/features/community/components/NoticeAdminCreateModal.tsx
// 공지사항 관리 전용 작성 모달 — 유형 선택 없음(항상 공지), 노출 범위만 선택

import { useState, useMemo } from "react";
import {
  createCommunityBoardPost,
  type ScopeNodeMinimal,
  type CommunityScopeParams,
} from "../api/community.api";
import { Button } from "@/shared/ui/ds";
import { useModalKeyboard } from "@/shared/ui/modal";
import { feedback } from "@/shared/ui/feedback/feedback";
import "@/features/community/community.css";

export type NoticeScope = "all" | "lecture" | "session";

export interface NoticeAdminCreateModalProps {
  noticeTypeId: number;
  scope: NoticeScope;
  scopeNodes: ScopeNodeMinimal[];
  scopeParams: CommunityScopeParams;
  effectiveLectureId?: number;
  sessionId?: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function NoticeAdminCreateModal({
  noticeTypeId,
  scope,
  scopeNodes,
  effectiveLectureId,
  sessionId,
  onClose,
  onSuccess,
}: NoticeAdminCreateModalProps) {
  const [title, setTitle] = useState("");
  const [selectedExposureNodeId, setSelectedExposureNodeId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      await createCommunityBoardPost({
        block_type: noticeTypeId,
        title: title.trim(),
        content: "",
        node_ids: exposureNodeIds,
      });
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
            placeholder="제목"
            style={{ width: "100%" }}
            aria-required
          />
        </div>

        <p className="community-field__hint">
          등록 후 오른쪽 상세 영역에서 내용을 작성할 수 있습니다.
        </p>

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
