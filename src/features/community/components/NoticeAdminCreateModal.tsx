// PATH: src/features/community/components/NoticeAdminCreateModal.tsx
// 공지사항 관리 전용 작성 모달 — 유형 선택 없음(항상 공지), 노출 범위만 선택

import { useState, useMemo } from "react";
import {
  createCommunityBoardPost,
  type ScopeNodeMinimal,
  type CommunityScopeParams,
} from "../api/community.api";
import { Button } from "@/shared/ui/ds";

export type NoticeScope = "all" | "lecture" | "session";

export interface NoticeAdminCreateModalProps {
  /** 공지 유형 ID (필수). 블록 타입 중 code=notice 인 것 — 단일 소스로 QnA/공지 혼선 제거 */
  noticeTypeId: number;
  scope: NoticeScope;
  scopeNodes: ScopeNodeMinimal[];
  scopeParams: CommunityScopeParams;
  effectiveLectureId?: number;
  sessionId?: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * 공지 관리 페이지 전용 생성 모달.
 * - 유형(블록 타입) 선택 없음 → 항상 noticeTypeId 사용
 * - scope가 "all"일 때만 "노출 위치(강의)" 선택
 */
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
        (x) => x.lecture === effectiveLectureId && x.session === sessionId
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
      console.error(e);
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notice-admin-create-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
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
          maxWidth: 480,
          width: "90%",
          boxShadow: "var(--elevation-3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="notice-admin-create-title" style={{ marginBottom: 16, fontSize: 18, fontWeight: 700 }}>
          공지 작성
        </h3>

        {scope === "all" && (
          <div style={{ marginBottom: 12 }}>
            <label
              htmlFor="notice-exposure-node"
              style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}
            >
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

        <div style={{ marginBottom: 12 }}>
          <label
            htmlFor="notice-title"
            style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}
          >
            제목
          </label>
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

        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 16 }}>
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
